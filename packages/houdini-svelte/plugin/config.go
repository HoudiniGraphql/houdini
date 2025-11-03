package plugin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func (p *HoudiniSvelte) DefaultConfig(
	ctx context.Context,
) (config.PluginConfig, error) {
	// we need to determine if the user is using the plugin in a kit or svelte project
	// to do that let's look in the package.json for sveltekit as dependency
	pluginConfig, err := p.DB.PluginConfig(ctx)
	if err != nil {
		return config.PluginConfig{}, err
	}

	if pluginConfig.Framework == "" {
		// load the project projectConfig
		projectConfig, err := p.DB.ProjectConfig(ctx)
		if err != nil {
			return pluginConfig, err
		}

		packageJSON, err := afero.ReadFile(
			p.Fs,
			filepath.Join(projectConfig.ProjectRoot, "package.json"),
		)
		if err != nil {
			return pluginConfig, err
		}

		// if the package.json references sveltekit, we are in a kit project
		if strings.Contains(string(packageJSON), "@sveltejs/kit") {
			pluginConfig.Framework = config.PluginFrameworkKit
		} else {
			pluginConfig.Framework = config.PluginFrameworkSvelte
		}
	}

	if pluginConfig.ClientPath == "" {
		pluginConfig.ClientPath = "./src/client"
	}

	if pluginConfig.CustomStores.Query == "" {
		pluginConfig.CustomStores.Query = "$houdini/plugins/houdini-svelte/runtime/stores/query.js#QueryStore"
	}

	if pluginConfig.CustomStores.Mutation == "" {
		pluginConfig.CustomStores.Mutation = "$houdini/plugins/houdini-svelte/runtime/stores/mutation.js#MutationStore"
	}

	if pluginConfig.CustomStores.Fragment == "" {
		pluginConfig.CustomStores.Fragment = "$houdini/plugins/houdini-svelte/runtime/stores/fragment.js#FragmentStore"
	}

	if pluginConfig.CustomStores.Subscription == "" {
		pluginConfig.CustomStores.Subscription = "$houdini/plugins/houdini-svelte/runtime/stores/subscription.js#SubscriptionStore"
	}

	if pluginConfig.CustomStores.QueryCursor == "" {
		pluginConfig.CustomStores.QueryCursor = "$houdini/plugins/houdini-svelte/runtime/stores/pagination/query.js#QueryStoreCursor"
	}

	if pluginConfig.CustomStores.QueryOffset == "" {
		pluginConfig.CustomStores.QueryOffset = "$houdini/plugins/houdini-svelte/runtime/stores/pagination/query.js#QueryStoreOffset"
	}

	if pluginConfig.CustomStores.FragmentOffset == "" {
		pluginConfig.CustomStores.FragmentOffset = "$houdini/plugins/houdini-svelte/runtime/stores/pagination/fragment.js#FragmentStoreOffset"
	}

	if pluginConfig.CustomStores.FragmentCursor == "" {
		pluginConfig.CustomStores.FragmentCursor = "$houdini/plugins/houdini-svelte/runtime/stores/pagination/fragment.js#FragmentStoreCursor"
	}

	return pluginConfig, nil
}

func (p *HoudiniSvelte) AfterLoad(ctx context.Context) error {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return err
	}
	pluginConfig, err := p.DB.PluginConfig(ctx)
	if err != nil {
		return err
	}

	// the first thing we need to do is verify the client path is valid
	clientPath := filepath.Join(projectConfig.ProjectRoot, pluginConfig.ClientPath)

	// we need to check 3 paths for existence (the client path and then ts and js extensions)
	found := false
	paths := []string{clientPath, clientPath + ".ts", clientPath + ".js"}
	for _, target := range paths {
		_, err := os.Stat(target)
		if err == nil {
			found = true
			break
		}
	}

	// if we didn't find a client then we need to throw an error
	if !found {
		return plugins.Error{
			Message: fmt.Sprintf(
				`File "%s.(ts,js)" is missing. Either create it or set the client property in houdini.config.js file to target your houdini client file.`,
				pluginConfig.ClientPath,
			),
			Detail: `It has to be a relative path (from houdini.config.js) to your client file. The file must have a default export with an instance of HoudiniClient.`,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: pluginConfig.ClientPath,
				},
			},
		}
	}

	// if we got this far, we're done
	return nil
}
