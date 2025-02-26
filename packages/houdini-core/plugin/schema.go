package plugin

import (
	"context"
	"io"
	"path"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"zombiezen.com/go/sqlite/sqlitex"

	houdiniSchema "code.houdinigraphql.com/packages/houdini-core/plugin/schema"
)

// The core plugin is responsible for parsing the users schrma file and loading it into the database
func (p *HoudiniCore) Schema(ctx context.Context) error {
	// the first thing we have to do is import the schema from the database
	config, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// grab a connection to the database for this
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// read the schema file
	schemaPath := path.Join(config.ProjectRoot, config.SchemaPath)
	file, err := p.Fs.Open(schemaPath)
	if err != nil {
		return plugins.Error{
			Message: "could not open schema file",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}
	defer file.Close()
	fileContents, err := io.ReadAll(file)
	if err != nil {
		return plugins.Error{
			Message: "could not read schema file",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}

	// parse and validate the schema
	schema, err := gqlparser.LoadSchema(&ast.Source{
		Input: string(fileContents),
	})
	if err != nil {
		return plugins.Error{
			Message: "encountered error parsing schema file: " + err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}

	// all of the schema operations are done in a transaction
	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// prepare the statements we'll use
	statements, finalize := houdiniSchema.PrepareSchemaInsertStatements(conn)
	defer finalize()

	// import the user's schema into the database
	errors := &plugins.ErrorList{}
	houdiniSchema.WriteProjectSchema(schemaPath, p.DB, schema, statements, errors)
	if errors.Len() > 0 {
		return commit(errors)
	}

	// write the internal schema
	err = houdiniSchema.WriteInternalSchema(p.DB, statements)
	if err != nil {
		err = plugins.Error{
			Message: "encountered error adding internal schema elements",
			Detail:  err.Error(),
		}
		return commit(err)
	}

	// we're done
	return commit(nil)
}
