package runtimeScalars_test

import (
	"context"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtimeScalars"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
	"code.houdinigraphql.com/plugins/tests"
)

func TestRuntimeScalars(t *testing.T) {
	// a query with a runtime scalar needs to be extracted as a
	// query with the equivalent scalar type and the runtime scalar directive
	query := `
		query UserInfo($user: UserFromSession!) {
			user(id: $user)
		}
	`

	// create and wire up a database we can test against
	db, err := plugins.NewTestPool[config.PluginConfig]()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	defer db.Close()
	db.SetProjectConfig(plugins.ProjectConfig{
		RuntimeScalars: map[string]string{
			"UserFromSession": "ID",
		},
	})
	plugin := &plugin.HoudiniCore{}
	plugin.SetDatabase(db)

	conn, err := db.Take(context.Background())
	require.Nil(t, err)
	defer db.Put(conn)

	// write the schema to the database
	err = tests.WriteDatabaseSchema(conn)
	require.Nil(t, err)

	statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
	require.Nil(t, err)
	defer finalize()

	typeCaches, err := documents.LoadTypeCache(context.Background(), db)
	require.Nil(t, err)

	// documents reference their raw document by foreign key, so the fixture row
	// has to exist just like it would after a real extraction
	require.Nil(t, tests.InsertRawDocument(conn, 1, "user-info.gql", query))

	// load the query into the database as a pending query
	err = documents.LoadPendingQuery(context.Background(), db, conn, documents.PendingQuery{
		ID:    1,
		Query: query,
	}, statements, typeCaches)
	require.Nil(t, err)

	// now trigger the component fields portion of the proces
	errs := &plugins.ErrorList{}
	runtimeScalars.TransformVariables(context.Background(), db, errs)
	require.Equal(t, 0, errs.Len(), errs.Error())

	// to check that the query was extracted correctly we need to look up the query
	// we just created along with its inputs and any directives
	queryRow, err := conn.Prepare(`
		SELECT
			documents.name,
			document_variable_directive_arguments.name,
			document_variable_directive_arguments.value
		FROM documents
			JOIN document_variables ON documents.id = document_variables.document
			JOIN document_variable_directives ON document_variables.id = document_variable_directives.parent
			JOIN document_variable_directive_arguments ON document_variable_directives.id = document_variable_directive_arguments.parent
		WHERE documents.name = ?
	`)
	require.Nil(t, err)
	queryRow.BindText(1, "UserInfo")
	defer queryRow.Finalize()
	queryRow.Step()

	documentName := queryRow.ColumnText(0)
	name := queryRow.ColumnText(1)
	value := queryRow.ColumnText(2)

	require.Equal(t, "UserInfo", documentName)
	require.Equal(t, "type", name)
	require.Equal(t, "2", value)
}

// HMR re-extracts one file and runs AfterExtract scoped to a task. the
// re-extracted document and its variables get fresh ids
func TestRuntimeScalars_incrementalAfterExtract(t *testing.T) {
	ctx := context.Background()

	db, err := plugins.NewTestPool[config.PluginConfig]()
	require.Nil(t, err)
	defer db.Close()

	conn, err := db.Take(ctx)
	require.Nil(t, err)
	require.Nil(t, tests.WriteDatabaseSchema(conn))
	db.Put(conn)

	db.SetProjectConfig(plugins.ProjectConfig{
		ProjectRoot: "/project",
		SchemaPath:  "schema.graphql",
		RuntimeDir:  ".houdini",
		Include:     []string{"**/*.gql"},
		Exclude:     []string{},
		RuntimeScalars: map[string]string{
			"UserFromSession": "Int",
		},
	})

	fs := afero.NewMemMapFs()
	require.Nil(t, fs.MkdirAll("/project", 0755))
	require.Nil(t, afero.WriteFile(fs, "/project/schema.graphql", []byte(`
		type Query {
			me(id: Int!): Int
			hello: String
		}
	`), 0644))
	require.Nil(t, afero.WriteFile(fs, "/project/a.gql", []byte(`query A { hello }`), 0644))
	require.Nil(t, afero.WriteFile(fs, "/project/b.gql", []byte(`query B($id: UserFromSession!) { me(id: $id) }`), 0644))

	core := &plugin.HoudiniCore{}
	core.SetDatabase(db)
	core.SetFilesystem(fs)
	require.Nil(t, core.Schema(ctx))

	// full run
	require.Nil(t, core.ExtractDocuments(ctx, plugins.ExtractDocumentsInput{}))
	require.Nil(t, core.AfterExtract(ctx))
	require.Equal(t, "Int", variableState(t, db, "B"))

	// the HMR path for b.gql, mirroring what the vite plugin does
	require.Nil(t, db.ExecQuery(ctx, `DELETE FROM raw_documents WHERE filepath = 'b.gql'`, nil))
	require.Nil(t, core.ExtractDocuments(ctx, plugins.ExtractDocumentsInput{
		Filepaths: []string{"/project/b.gql"},
	}))
	require.Nil(t, db.ExecQuery(ctx,
		`UPDATE raw_documents SET current_task = 'task-1' WHERE filepath = 'b.gql'`,
		nil,
	))
	require.Nil(t, core.AfterExtract(plugins.ContextWithTaskID(ctx, "task-1")))
	require.Equal(t, "Int", variableState(t, db, "B"))
}

// variableState returns the type of the document's only variable and checks
// its runtime scalar directive
func variableState[PluginConfig any](
	t *testing.T,
	db plugins.DatabasePool[PluginConfig],
	document string,
) string {
	t.Helper()

	conn, err := db.Take(context.Background())
	require.Nil(t, err)
	defer db.Put(conn)

	search, err := conn.Prepare(`
		SELECT
			document_variables.type,
			document_variable_directives.directive,
			argument_values.raw,
			argument_values.document = documents.id
		FROM documents
			JOIN document_variables ON documents.id = document_variables.document
			LEFT JOIN document_variable_directives ON document_variables.id = document_variable_directives.parent
			LEFT JOIN document_variable_directive_arguments ON document_variable_directives.id = document_variable_directive_arguments.parent
			LEFT JOIN argument_values ON document_variable_directive_arguments.value = argument_values.id
		WHERE documents.name = ?
	`)
	require.Nil(t, err)
	defer search.Finalize()
	search.BindText(1, document)

	hasRow, err := search.Step()
	require.Nil(t, err)
	require.True(t, hasRow, "document %q has no variables", document)

	variableType := search.ColumnText(0)
	require.Equal(t, graphql.RuntimeScalarDirective, search.ColumnText(1))
	require.Equal(t, "UserFromSession", search.ColumnText(2))
	require.True(t, search.ColumnBool(3), "the directive's argument value must belong to the document")

	hasRow, err = search.Step()
	require.Nil(t, err)
	require.False(t, hasRow, "expected exactly one variable on %q", document)

	return variableType
}
