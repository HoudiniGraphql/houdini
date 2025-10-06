package runtime

import (
	"context"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func GenerateRuntimeIndexFile(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) error {
	// load the project config to look up the runtime directory
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// we are going to populate the runtime index
	indexPath := path.Join(config.ProjectRoot, config.RuntimeDir, "index.js")
	dTsPath := path.Join(config.ProjectRoot, config.RuntimeDir, "index.d.ts")

	// delete both of the files to start fresh
	_ = fs.Remove(indexPath)
	_ = fs.Remove(dTsPath)

	definitionsRelative, err := filepath.Rel(config.RuntimeDir, config.DefinitionsDirectory())
	if err != nil {
		return err
	}

	// before we doing any kind of file io let's determine the value we will write so we can compare with the existing value to know if we changed anything

	// there are 2 things we need to look up: the name of every document as well as any plugins with exported runtimes
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}
	defer db.Put(conn)

	documentSearch, err := conn.Prepare(`
		SELECT 
			name 
		FROM documents 
		JOIN raw_documents ON documents.raw_document = raw_documents.id
		WHERE printed IS NOT NULL
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer documentSearch.Finalize()

	// generate an export for every document
	indexDocs := []string{}
	dTsDocs := []string{}
	err = db.StepStatement(ctx, documentSearch, func() {
		name := documentSearch.GetText("name")
		indexDocs = append(
			indexDocs,
			fmt.Sprintf("export { default as %s } from './artifacts/%s.js'", name, name),
		)
		dTsDocs = append(
			dTsDocs,
			fmt.Sprintf("export * from './artifacts/%s'", name),
		)
	})
	if err != nil {
		return err
	}

	// and an export for every included runtime
	pluginSearch, err := conn.Prepare(`
		SELECT name FROM plugins where include_runtime IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer pluginSearch.Finalize()
	runtimeExport := []string{}
	err = db.StepStatement(ctx, pluginSearch, func() {
		name := pluginSearch.GetText("name")
		runtimeExport = append(
			runtimeExport,
			fmt.Sprintf("export * from './plugins/%s/runtime'", name),
		)
	})
	if err != nil {
		return err
	}

	// build up the indexContent of the file
	indexContent := fmt.Sprintf(`export * from './runtime/client'
export * from './runtime'
export * from './%s'
%s
%s
`,
		definitionsRelative,
		strings.Join(runtimeExport, "\n"),
		strings.Join(indexDocs, "\n"),
	)

	// if we got this far then we need to update the file
	err = afero.WriteFile(fs, indexPath, []byte(indexContent), 0644)
	if err != nil {
		return err
	}

	dTsContent := fmt.Sprintf(`export * from './runtime/client'
export * from './runtime'
export * from './%s'
%s
%s
`,
		definitionsRelative,
		strings.Join(runtimeExport, "\n"),
		strings.Join(dTsDocs, "\n"),
	)

	// if we got this far then we need to update the file
	err = afero.WriteFile(fs, dTsPath, []byte(dTsContent), 0644)
	if err != nil {
		return err
	}

	// return the updated filepath
	return nil
}
