package plugin

import (
	"context"
	"fmt"
	"path"
	"path/filepath"
	"strings"
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
	case "adapter.js":
		// the current content is the svelte adapter
		if pluginConfig.Framework == PluginFrameworkSvelte {
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

	case "client.js":
		// compute the relative path from the client import file to the user's client
		clientPath := path.Join(projectConfig.ProjectRoot, pluginConfig.ClientPath)
		relPath, err := filepath.Rel(projectConfig.PluginRuntimeDirectory(p.Name()), clientPath)
		if err != nil {
			return "", err
		}

		// replace the constant
		return strings.Replace(content, "HOUDINI_CLIENT_PATH", relPath, 1), nil
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
	// we're done
	return fmt.Sprintf(`

export * from './%s/stores/index.js'
`, pluginDir), nil
}
