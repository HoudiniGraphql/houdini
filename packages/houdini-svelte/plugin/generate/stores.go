package generate

import (
	"context"
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

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

	errs := &plugins.ErrorList{}

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
				WHEN COUNT(dl_cursor.document) > 0 THEN 'cursor'
				WHEN COUNT(dl_offset.document) > 0 THEN 'offset'
				ELSE ''
			END as refetch_method
		FROM documents d
		LEFT JOIN document_variables dv_required ON (
			dv_required.document = d.id
			AND dv_required.type_modifiers LIKE '%!%'
			AND dv_required.default_value IS NULL
		)
		LEFT JOIN discovered_lists dl_cursor ON (
			dl_cursor.document = d.id
			AND dl_cursor.connection = 1 AND dl_cursor.paginate is not null
		)
		LEFT JOIN discovered_lists dl_offset ON (
			dl_offset.document = d.id
			AND dl_offset.connection = 0 AND dl_offset.paginate is not null
		)
		GROUP BY d.id, d.name, d.kind
		HAVING d.visible = 1
		ORDER BY d.name ASC
	`)
	if err != nil {
		db.Put(conn)
		return nil, err
	}

	storesDir := filepath.Join(projectConfig.PluginDirectory("houdini-svelte"), "stores")

	// Make sure the stores directory exists
	err = fs.MkdirAll(storesDir, 0755)
	if err != nil {
		return nil, fmt.Errorf("failed to create stores directory: %w", err)
	}

	// Collect all document rows first so we can release the DB connection before
	// spawning workers (each worker needs its own connection for other queries).
	type storeDoc struct {
		name              string
		kind              string
		variablesRequired bool
		refetchMethod     string
	}
	var docs []storeDoc
	err = db.StepStatement(ctx, stmt, func() {
		docs = append(docs, storeDoc{
			name:              stmt.ColumnText(0),
			kind:              stmt.ColumnText(1),
			variablesRequired: stmt.ColumnBool(2),
			refetchMethod:     stmt.ColumnText(3),
		})
	})
	if err != nil {
		return nil, err
	}
	// Release the connection before the parallel section.
	stmt.Finalize()
	db.Put(conn)

	// Fan out: generate + write each store file in parallel.
	type storeResult struct {
		storePath string
		changed   bool
		err       error
	}
	resultCh := make(chan storeResult, len(docs))
	docCh := make(chan storeDoc, len(docs))

	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for doc := range docCh {
				storeName := doc.name + "Store"
				var content string
				var genErr error
				switch doc.kind {
				case "query":
					content, genErr = generateQueryStore(pluginConfig, doc.name, storeName, doc.variablesRequired, doc.refetchMethod)
				case "mutation":
					content, genErr = generateMutationStore(pluginConfig, doc.name, storeName)
				case "subscription":
					content, genErr = generateSubscriptionStore(pluginConfig, doc.name, storeName)
				case "fragment":
					content, genErr = generateFragmentStore(pluginConfig, doc.name, storeName, doc.refetchMethod, doc.variablesRequired)
				default:
					// unknown kind — skip without error
					continue
				}
				if genErr != nil {
					resultCh <- storeResult{err: genErr}
					continue
				}
				storePath := filepath.Join(storesDir, doc.name+".ts")
				if existing, readErr := afero.ReadFile(fs, storePath); readErr == nil && string(existing) == content {
					resultCh <- storeResult{storePath: storePath, changed: false}
					continue
				}
				if writeErr := afero.WriteFile(fs, storePath, []byte(content), 0644); writeErr != nil {
					resultCh <- storeResult{err: writeErr}
					continue
				}
				resultCh <- storeResult{storePath: storePath, changed: true}
			}
		}()
	}

	for _, doc := range docs {
		docCh <- doc
	}
	close(docCh)
	wg.Wait()
	close(resultCh)

	var generatedFiles []string
	for res := range resultCh {
		if res.err != nil {
			errs.Append(plugins.WrapError(res.err))
			continue
		}
		if res.changed {
			generatedFiles = append(generatedFiles, res.storePath)
		}
	}
	if errs.Len() > 0 {
		return nil, errs
	}

	// Build the index file from the ordered docs slice (query was ORDER BY name ASC).
	var indexValue strings.Builder
	for _, doc := range docs {
		fmt.Fprintf(&indexValue, "export * from './%s.js'\n", doc.name)
	}
	indexFilePath := filepath.Join(storesDir, "index.ts")
	indexContent := indexValue.String()
	if existing, readErr := afero.ReadFile(fs, indexFilePath); readErr != nil || string(existing) != indexContent {
		if writeErr := afero.WriteFile(fs, indexFilePath, []byte(indexContent), 0644); writeErr != nil {
			return nil, writeErr
		}
		generatedFiles = append(generatedFiles, indexFilePath)
	}

	return generatedFiles, nil
}

func generateQueryStore(
	pluginConfig config.PluginConfig,
	name string,
	storeName string,
	variablesRequired bool,
	refetchMethod config.StorePaginationType,
) (string, error) {
	storeImport, err := pluginConfig.StoreBaseClassImport("query", refetchMethod)
	if err != nil {
		return "", err
	}

	classDeclaration := fmt.Sprintf(
		"export class %s extends %s<%s$result, %s$input>",
		storeName,
		storeImport.Name,
		name,
		name,
	)

	return fmt.Sprintf(`import type { QueryStoreFetchParams } from '$houdini'
import { %s } from '%s'
import artifact from '$houdini/artifacts/%s.js'
import type { %s$result, %s$input } from '$houdini/artifacts/%s.js'

%s {
    constructor() {
        super({
            artifact,
            storeName: "%s",
            variables: %t,
        })
    }
}

export async function load_%s(params: QueryStoreFetchParams<%s$result, %s$input>): Promise<{%s: %s}>{
    const store = new %s()
    await store.fetch(params)
    return { %s: store }
}`,
		storeImport.Name,
		storeImport.Module,
		name,
		name,
		name,
		name,
		classDeclaration,
		storeName,
		variablesRequired,
		name,
		name,
		name,
		name,
		storeName,
		storeName,
		name,
	), nil
}

func generateMutationStore(
	pluginConfig config.PluginConfig,
	name string, storeName string,
) (string, error) {
	storeImport, err := pluginConfig.StoreBaseClassImport(
		"mutation",
		config.StorePaginationTypeNone,
	)
	if err != nil {
		return "", err
	}

	storeContent := fmt.Sprintf(
		`import artifact from '$houdini/artifacts/%s.js'
import type { %s$result, %s$input, %s$optimistic } from '$houdini/artifacts/%s.js'
import { %s } from '%s'

export class %s extends %s<%s$result, %s$input, %s$optimistic> {
    constructor() {
        super({
            artifact,
        })
    }
}`,
		name,
		name,
		name,
		name,
		name,
		storeImport.Name,
		storeImport.Module,
		storeName,
		storeImport.Name,
		name,
		name,
		name,
	)

	return storeContent, nil
}

func generateSubscriptionStore(
	pluginConfig config.PluginConfig,
	name string,
	storeName string,
) (string, error) {
	storeImport, err := pluginConfig.StoreBaseClassImport(
		"subscription",
		config.StorePaginationTypeNone,
	)
	if err != nil {
		return "", err
	}

	storeContent := fmt.Sprintf(
		`import artifact from '$houdini/artifacts/%s.js'
import type { %s$result, %s$input }from '$houdini/artifacts/%s.js'
import { %s } from '%s'

export class %s extends %s<%s$result, %s$input> {
    constructor() {
        super({
            artifact,
        })
    }
}`,
		name,
		name,
		name,
		name,
		storeImport.Name,
		storeImport.Module,
		storeName,
		storeImport.Name,
		name,
		name,
	)

	return storeContent, nil
}

func generateFragmentStore(
	pluginConfig config.PluginConfig,
	name string,
	storeName string,
	refetchMethod config.StorePaginationType,
	variablesRequired bool,
) (string, error) {
	storeImport, err := pluginConfig.StoreBaseClassImport("fragment", refetchMethod)
	if err != nil {
		return "", err
	}

	extraImport := ""
	extraFields := ""
	if refetchMethod != config.StorePaginationTypeNone {
		variablesRequired = true
		extraImport = fmt.Sprintf(
			`
import _PaginationArtifact from '$houdini/artifacts/%s.js'`,
			graphql.FragmentPaginationQueryName(name),
		)
		extraFields = fmt.Sprintf(`
            variables: %t,
            paginationArtifact: _PaginationArtifact,`, variablesRequired)
	}

	storeContent := fmt.Sprintf(`import { %s } from '%s'
import artifact from '$houdini/artifacts/%s.js'
import type { %s$data, %s$input } from '$houdini/artifacts/%s.js'%s

export class %s extends %s<%s$data, { %s: any }, %s$input> {
    constructor() {
        super({
            artifact,
            storeName: "%s",%s
        })
    }
}`, storeImport.Name, storeImport.Module, name, name, name, name, extraImport, storeName, storeImport.Name, name, name, name, storeName, extraFields)

	return storeContent, nil
}
