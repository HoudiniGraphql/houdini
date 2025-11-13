package plugin

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/generate"
	"github.com/spf13/afero"
)

func (p *HoudiniSvelte) IncludeRuntime(ctx context.Context) (string, error) {
	return "runtime", nil
}

func (p *HoudiniSvelte) TransformRuntime(
	ctx context.Context,
	fp string,
	content string,
) (string, error) {
	pluginConfig, err := p.DB.PluginConfig(ctx)
	if err != nil {
		return "", err
	}
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return "", err
	}

	switch fp {
	case "adapter.ts":
		// the current content is the svelte adapter
		if pluginConfig.Framework == config.PluginFrameworkSvelte {
			return content, nil
		}

		return `import { browser, building } from '$app/environment'
import { error as svelteKitError, redirect as svelteKitRedirect } from '@sveltejs/kit'

export const isBrowser = browser

export let clientStarted = false;

export function setClientStarted() {
	clientStarted = true
}

export const isPrerender = building

export const error = svelteKitError
export const redirect = svelteKitRedirect
`, nil

	case "client.ts":
		// compute the relative path from the client import file to the user's client
		clientPath := filepath.Join(projectConfig.ProjectRoot, pluginConfig.ClientPath)
		relPath, err := filepath.Rel(projectConfig.PluginRuntimeDirectory(p.Name()), clientPath)
		if err != nil {
			return "", err
		}
		relPath = filepath.ToSlash(relPath)

		// replace the constant
		return strings.ReplaceAll(content, "HOUDINI_CLIENT_PATH", relPath), nil
	}

	// no matches, just return
	return content, nil
}

func (p *HoudiniSvelte) IndexFile(ctx context.Context, targetPath string) (string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return "", err
	}

	pluginDir, err := filepath.Rel(
		filepath.Dir(targetPath),
		projectConfig.PluginDirectory(p.Name()),
	)
	if err != nil {
		return "", err
	}
	pluginDir = filepath.ToSlash(pluginDir)

	// we just need to export all of the stores we'll generate
	return fmt.Sprintf(`export * from './%s/stores/index.js'`, pluginDir), nil
}

func (p *HoudiniSvelte) GenerateRuntime(ctx context.Context) ([]string, error) {
	// for now, we only need to update the index files
	files, err := p.UpdateIndexFiles(ctx)
	if err != nil {
		return nil, err
	}

	// and generate the stores
	storeFiles, err := generate.GenerateStores(ctx, p.Database(), p.Filesystem())
	if err != nil {
		return nil, err
	}

	// keep the slice of files up to date
	files = append(files, storeFiles...)

	// we're done
	return files, nil
}

func (p *HoudiniSvelte) UpdateIndexFiles(ctx context.Context) ([]string, error) {
	// our goal is to add type declarations for the graphql function that's
	// exported from the runtime index file

	// Get project config to determine the target file path
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Target file path
	targetPath := filepath.Join(
		projectConfig.ProjectRoot,
		projectConfig.RuntimeDir,
		"runtime",
		"index.ts",
	)

	// Get database connection
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer p.DB.Put(conn)

	// Prepare the query statement
	stmt, err := conn.Prepare(`
		SELECT d.name, rd.content
		FROM documents d
		JOIN raw_documents rd ON d.raw_document = rd.id
		WHERE d.visible = 1
		ORDER BY d.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()

	// Execute the query and collect results
	var imports strings.Builder
	var overloads strings.Builder
	err = p.DB.StepStatement(ctx, stmt, func() {
		name := stmt.ColumnText(0)
		content := stmt.ColumnText(1)

		imports.WriteString(
			fmt.Sprintf(
				"import type { %sStore } from '$houdini/plugins/houdini-svelte/stores/%s'\n",
				name,
				name,
			),
		)
		overloads.WriteString(
			fmt.Sprintf("export function graphql(str: `%s`): %sStore;\n", content, name),
		)
	})
	if err != nil {
		return nil, err
	}

	// Read the existing file content
	existingContent, err := afero.ReadFile(p.Fs, targetPath)
	if err != nil {
		return nil, err
	}

	// Find the position to insert overloads (before the generic function declaration)
	existingStr := string(existingContent)
	genericFuncLine := "export function graphql<_Payload, _Result = _Payload>(str: string): _Result"
	insertPos := strings.Index(existingStr, genericFuncLine)
	if insertPos == -1 {
		return nil, fmt.Errorf(
			"could not find generic function declaration in %s\n%s",
			targetPath,
			existingStr,
		)
	}

	// Build the new content
	var newContent strings.Builder

	// Add imports at the beginning
	newContent.WriteString("\n")
	newContent.WriteString(imports.String())
	newContent.WriteString("\n")
	newContent.WriteString(existingStr[:insertPos])

	// Add overloads before the generic function
	newContent.WriteString(overloads.String())

	// Add the original generic function
	newContent.WriteString(existingStr[insertPos:])

	newString := newContent.String()
	if newString == existingStr {
		// no changes
		return []string{}, nil
	}

	// Write the modified content back to the file
	err = afero.WriteFile(
		p.Fs,
		targetPath,
		[]byte(newContent.String()),
		0644,
	)
	if err != nil {
		return nil, err
	}

	// there needs to always be a stores/index.ts file even if nothing has been generated yet
	storeIndexPath := filepath.Join(
		projectConfig.PluginDirectory(p.Name()),
		"stores",
		"index.ts",
	)
	err = p.Fs.MkdirAll(filepath.Dir(storeIndexPath), 0755)
	if err != nil {
		return nil, err
	}
	exists, err := afero.Exists(p.Fs, storeIndexPath)
	if err != nil {
		return nil, err
	}

	if !exists {
		err = afero.WriteFile(p.Fs, storeIndexPath, []byte(""), 0644)
		if err != nil {
			return nil, err
		}
	}

	// we're done
	return []string{
		targetPath,
	}, nil
}

func (p *HoudiniSvelte) GenerateFragmentTypeDefs(ctx context.Context) ([]string, error) {
	// Get project config to determine the target file path
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Get database connection
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer p.DB.Put(conn)

	// Prepare the query statement
	stmt, err := conn.Prepare(`
		SELECT d.name
		FROM documents d
		WHERE d.visible = 1
		ORDER BY d.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()

	// Execute the query and collect results
	var imports strings.Builder
	var overloads strings.Builder
	err = p.DB.StepStatement(ctx, stmt, func() {
		name := stmt.ColumnText(0)

		imports.WriteString(
			fmt.Sprintf(
				`import { %s$input, %s$data } from "$houdini/artifacts/%s";
import { %sStore } from "$houdini/plugins/houdini-svelte/stores/%s";
`,
				name,
				name,
				name,
				name,
				name,
			),
		)
		overloads.WriteString(
			fmt.Sprintf(`export function fragment(
		initialValue: {
				" $fragments": {
						%s: any;
				};
		} | {
				"__typename": "non-exhaustive; don't match this";
		},
		document: %sStore
): FragmentStoreInstance<%s$data, %s$input>;
export function fragment(
		initialValue: {
				" $fragments": {
						%s: any;
				};
		} | null | undefined | {
				"__typename": "non-exhaustive; don't match this";
		},
		document: %sStore
): FragmentStoreInstance<%s$data | null, %s$input>;
`, name, name, name, name, name, name, name, name),
		)
	})
	if err != nil {
		return nil, err
	}

	// Target file path
	targetPath := filepath.Join(
		projectConfig.PluginRuntimeDirectory(p.Name()),
		"fragments.ts",
	)

	// Read the existing file content
	existingContent, err := afero.ReadFile(p.Fs, targetPath)
	if err != nil {
		fmt.Println("no existing content")
		return nil, err
	}

	// Find the position to insert overloads (before the generic function declaration)
	existingStr := string(existingContent)
	genericFuncLine := `export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment,
	fragment: FragmentStore<_Fragment['shape'], {}>
): Readable<Exclude<_Fragment['shape'], undefined>> & {
	data: Readable<_Fragment>
	artifact: FragmentArtifact
}`
	insertPos := strings.Index(existingStr, genericFuncLine)
	if insertPos == -1 {
		return nil, fmt.Errorf(
			"could not find generic function declaration in %s\n%s",
			targetPath,
			existingStr,
		)
	}

	// Build the new content
	var newContent strings.Builder

	// Add imports at the beginning
	newContent.WriteString(imports.String())
	newContent.WriteString(existingStr[:insertPos])

	// Add overloads before the generic function
	newContent.WriteString(overloads.String())

	// Add the original generic function
	newContent.WriteString(existingStr[insertPos:])

	newString := newContent.String()
	if newString == existingStr {
		// no changes
		return []string{}, nil
	}

	// Write the modified content back to the file
	err = afero.WriteFile(
		p.Fs,
		targetPath,
		[]byte(newContent.String()),
		0644,
	)
	if err != nil {
		return nil, err
	}

	err = p.Fs.MkdirAll(filepath.Dir(targetPath), 0755)
	if err != nil {
		return nil, err
	}
	exists, err := afero.Exists(p.Fs, targetPath)
	if err != nil {
		return nil, err
	}

	if !exists {
		err = afero.WriteFile(p.Fs, targetPath, []byte(""), 0644)
		if err != nil {
			return nil, err
		}
	}

	// we're done
	return []string{
		targetPath,
	}, nil
}
