package generate

import (
	"context"
	"fmt"
	"path"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

func GenerateStores(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) ([]string, error) {
	// Get project config
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	pluginConfig, err := db.PluginConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Get database connection
	conn, err := db.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	// Query for all documents with variable and pagination info using JOINs
	stmt, err := conn.Prepare(`
		SELECT
			d.name,
			d.kind,
			CASE
				WHEN COUNT(dv_required.id) > 0 THEN 1
				ELSE 0
			END as variables_required,
			CASE
				WHEN COUNT(dl_cursor.raw_document) > 0 THEN 'cursor'
				WHEN COUNT(dl_offset.raw_document) > 0 THEN 'offset'
				ELSE ''
			END as refetch_method
		FROM documents d
		LEFT JOIN document_variables dv_required ON (
			dv_required.document = d.id
			AND dv_required.type_modifiers LIKE '%!%'
			AND dv_required.default_value IS NULL
		)
		LEFT JOIN discovered_lists dl_cursor ON (
			dl_cursor.raw_document = d.raw_document
			AND dl_cursor.connection = 1
		)
		LEFT JOIN discovered_lists dl_offset ON (
			dl_offset.raw_document = d.raw_document
			AND dl_offset.connection = 0
		)
		GROUP BY d.id, d.name, d.kind
		ORDER BY d.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()

	var generatedFiles []string
	storesDir := path.Join(projectConfig.PluginDirectory("houdini-svelte"), "stores")

	// Make sure the stores directory exists
	err = fs.MkdirAll(storesDir, 0755)
	if err != nil {
		return nil, fmt.Errorf("failed to create stores directory: %w", err)
	}

	// Execute the query and generate stores
	err = db.StepStatement(ctx, stmt, func() {
		name := stmt.ColumnText(0)
		kind := stmt.ColumnText(1)
		variablesRequired := stmt.ColumnBool(2)
		refetchMethod := stmt.ColumnText(3)

		var storeContent string
		var typeDefContent string
		var err error

		switch kind {
		case "query":
			storeContent, typeDefContent, err = generateQueryStore(
				pluginConfig,
				name,
				variablesRequired,
				refetchMethod,
			)
		case "mutation":
			storeContent, typeDefContent, err = generateMutationStore(pluginConfig, name)
		case "subscription":
			storeContent, typeDefContent, err = generateSubscriptionStore(pluginConfig, name)
		case "fragment":
			storeContent, typeDefContent, err = generateFragmentStore(
				pluginConfig,
				name,
				variablesRequired,
				refetchMethod,
			)
		default:
			return // Skip unknown kinds
		}

		if err != nil {
			return
		}

		// Write the store file
		storePath := path.Join(storesDir, name+".js")
		err = afero.WriteFile(fs, storePath, []byte(storeContent), 0644)
		if err != nil {
			return
		}

		// Write the type definition file
		typeDefPath := path.Join(storesDir, name+".d.ts")
		err = afero.WriteFile(fs, typeDefPath, []byte(typeDefContent), 0644)
		if err != nil {
			return
		}

		generatedFiles = append(generatedFiles, storePath, typeDefPath)
	})
	if err != nil {
		return nil, err
	}

	return generatedFiles, nil
}

func generateQueryStore(
	pluginConfig config.PluginConfig,
	name string,
	variablesRequired bool,
	refetchMethod config.StorePaginationType,
) (string, string, error) {
	storeName := name + "Store"
	storeImport := pluginConfig.StoreBaseClassImport("query", refetchMethod)

	storeContent := fmt.Sprintf(`import { %s } from '%s'
import artifact from '$houdini/artifacts/%s.js'

export class %s extends %s {
	constructor() {
		super({
			artifact,
			storeName: "%s",
			variables: %t,
		})
	}
}

export async function load_%s(params) {
		const store = new %sStore()
		await store.fetch(params)
		return { %s: store }

}
`, storeImport.Name, storeImport.Module, name, storeName, storeImport.Name, storeName, variablesRequired, name, name, name)

	typeDefContent := fmt.Sprintf(`import type { %s } from '%s'
import type { QueryStoreFetchParams } from '$houdini'
import type { %s$input, %s$result } from '$houdini/artifacts/%s.js'

excport declare class %s extends %s<%s$result, %s$input> {
	constructor() 
}

		export declare const load_%s(params: QueryStoreFetchParams<%s$result, %s$input>) => Promise<{%s: %s}>
`,
		storeImport.Name,
		storeImport.Module,
		name,
		name,
		name,

		// signature
		storeName,
		storeImport.Name,
		name,
		name,

		// load function
		name,
		name,
		name,
		name,
		storeName,
	)

	return storeContent, typeDefContent, nil
}

func generateMutationStore(pluginConfig config.PluginConfig, name string) (string, string, error) {
	storeName := name + "Store"
	storeImport := pluginConfig.StoreBaseClassImport("mutation", config.StorePaginationTypeNone)

	storeContent := fmt.Sprintf(`import artifact from '$houdini/artifacts/%s.js'
import { %s } from '%s'

export class %s extends %s {
	constructor() {
		super({
			artifact,
		})
	}
}`, name, storeImport.Name, storeImport.Module, storeName, storeImport.Name)

	typeDefContent := ``

	return storeContent, typeDefContent, nil
}

func generateSubscriptionStore(
	pluginConfig config.PluginConfig,
	name string,
) (string, string, error) {
	storeName := name + "Store"
	storeImport := pluginConfig.StoreBaseClassImport("subscription", config.StorePaginationTypeNone)

	storeContent := fmt.Sprintf(`import artifact from '$houdini/artifacts/%s.js'
import { %s } from '%s'

export class %s extends %s {
	constructor() {
		super({
			artifact,
		})
	}
}`, name, storeImport.Name, storeImport.Module, storeName, storeImport.Name)

	typeDefContent := ``

	return storeContent, typeDefContent, nil
}

func generateFragmentStore(
	pluginConfig config.PluginConfig,
	name string,
	variablesRequired bool,
	refetchMethod config.StorePaginationType,
) (string, string, error) {
	storeName := name + "Store"
	storeImport := pluginConfig.StoreBaseClassImport("fragment", refetchMethod)

	extraImport := ""
	extraFields := ""
	if refetchMethod != config.StorePaginationTypeNone {
		extraImport = fmt.Sprintf(
			`
import _PaginationArtifact from '$houdini/artifacts/%s.js'`,
			graphql.FragmentPaginationQueryName(name),
		)
		extraFields = `
			paginationArtifact: _PaginationArtifact,`
		variablesRequired = true
	}

	storeContent := fmt.Sprintf(`import { %s } from '%s.js'
import artifact from '$houdini/artifacts/%s'%s

export class %s extends %s {
	constructor() {
		super({
			artifact,
			storeName: "%s",
			variables: %t,%s
		})
	}
}`, storeImport.Name, storeImport.Module, name, extraImport, storeName, storeImport.Name, storeName, variablesRequired, extraFields)

	typeDefContent := ``

	return storeContent, typeDefContent, nil
}
