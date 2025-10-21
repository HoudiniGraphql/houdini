package plugin

import (
	"context"
	"fmt"
	"path"
	"path/filepath"
	"strings"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
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
		clientPath := path.Join(projectConfig.ProjectRoot, pluginConfig.ClientPath)
		relPath, err := filepath.Rel(projectConfig.PluginRuntimeDirectory(p.Name()), clientPath)
		if err != nil {
			return "", err
		}

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

	pluginDir, err := filepath.Rel(path.Dir(targetPath), projectConfig.PluginDirectory(p.Name()))
	if err != nil {
		return "", err
	}

	// we just need to export all of the stores we'll generate
	return fmt.Sprintf(`export * from './%s/stores/index.js'`, pluginDir), nil
}

func (p *HoudiniSvelte) GenerateRuntime(ctx context.Context) ([]string, error) {
	// our goal is to add type declarations for the graphql function that's
	// exported from the runtime index file

	// Get project config to determine the target file path
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Target file path
	targetPath := path.Join(
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

	// Collect document data
	type docData struct {
		name    string
		content string
	}
	var docs []docData

	// Execute the query and collect results
	err = p.DB.StepStatement(ctx, stmt, func() {
		name := stmt.ColumnText(0)
		content := stmt.ColumnText(1)
		docs = append(docs, docData{name: name, content: content})
	})
	if err != nil {
		return nil, err
	}

	// Build imports and overloads with correct ordering
	var imports strings.Builder
	var overloads strings.Builder

	// Imports in alphabetical order (already sorted by query)
	for _, doc := range docs {
		imports.WriteString(
			fmt.Sprintf(
				"import type { %sStore } from '$houdini/plugins/houdini-svelte/stores/%s'\n",
				doc.name,
				doc.name,
			),
		)
	}

	// Overloads in reverse alphabetical order
	for i := len(docs) - 1; i >= 0; i-- {
		doc := docs[i]
		overloads.WriteString(
			fmt.Sprintf("export function graphql(str: `%s`): %sStore;\n", doc.content, doc.name),
		)
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
	storeIndexPath := path.Join(
		projectConfig.PluginDirectory(p.Name()),
		"stores",
		"index.ts",
	)
	err = p.Fs.MkdirAll(path.Dir(storeIndexPath), 0755)
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
