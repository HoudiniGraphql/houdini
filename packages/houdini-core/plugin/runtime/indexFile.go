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

func GenerateIndexFile(
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
	targetPath := path.Join(config.ProjectRoot, config.RuntimeDir, "index.js")
	definitionsRelative, err := filepath.Rel(config.RuntimeDir, config.DefinitionsIndexJs())
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
	docExports := []string{}
	err = db.StepStatement(ctx, documentSearch, func() {
		name := documentSearch.GetText("name")
		docExports = append(
			docExports,
			fmt.Sprintf("export { default as %s} from './artifacts/%s.js'", name, name),
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

	// build up the content of the file
	content := fmt.Sprintf(`
export * from './runtime/client'
export * from './runtime'
export * from './%s'
%s
%s`,
		definitionsRelative,
		strings.Join(docExports, "\n"),
		strings.Join(runtimeExport, "\n"),
	)

	// if the existing content is the same, then there's nothing to do
	if exists, err := afero.Exists(fs, targetPath); err == nil && exists {
		existingContent, err := afero.ReadFile(fs, targetPath)
		if err != nil {
			return err
		}

		if string(existingContent) == content {
			// we're done
			return nil
		}
	}

	// if we got this far then we need to update the file
	err = afero.WriteFile(fs, targetPath, []byte(content), 0644)
	if err != nil {
		return err
	}

	// return the updated filepath
	return nil
}
