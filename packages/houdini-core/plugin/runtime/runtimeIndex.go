package runtime

import (
	"context"
	"fmt"
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
	indexPath := filepath.Join(config.ProjectRoot, config.RuntimeDir, "index.ts")


	definitionsRelative, err := filepath.Rel(config.RuntimeDir, config.DefinitionsDirectory())
	if err != nil {
		return err
	}
	definitionsRelative = filepath.ToSlash(definitionsRelative)

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
		WHERE internal = 0
		ORDER BY name ASC
	`)
	if err != nil {
		return err
	}
	defer documentSearch.Finalize()

	// generate a TYPE-ONLY export for every document. The artifact's runtime value is its default
	// export (which `export *` never re-exports anyway — only the named $result/$input/$artifact
	// types), so a value-level `export *` would statically pull every artifact into the entry
	// chunk and defeat the manifest's per-route dynamic import (INEFFECTIVE_DYNAMIC_IMPORT). A
	// type-only re-export keeps the same types available from $houdini while erasing at runtime.
	indexDocs := []string{}
	err = db.StepStatement(ctx, documentSearch, func() {
		name := documentSearch.GetText("name")
		indexDocs = append(
			indexDocs,
			fmt.Sprintf("export type * from './artifacts/%s'", name),
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
		// the core runtime goes somewhere special so we dont need ot generate imports for it
		if name == "houdini-core" {
			return
		}

		// make sure the runtime exports the plugin runtime
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
	err = plugins.WriteFile(fs, indexPath, []byte(indexContent), 0644)
	if err != nil {
		return err
	}

	// return the updated filepath
	return nil
}
