package plugin

import (
	"context"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/plugins"
)

type PluginFramework = string

const (
	PluginFrameworkSvelte = "svelte"
	PluginFrameworkKit    = "kit"
)

type PluginConfig struct {
	Framework    PluginFramework        `json:"framework"`
	ClientPath   string                 `json:"client"`
	CustomStores PluginConfigStorePaths `json:"customStores"`
}

type PluginConfigStorePaths struct {
	Query          string `json:"query"`
	Mutation       string `json:"mutation"`
	Fragment       string `json:"fragment"`
	Subscription   string `json:"subscription"`
	QueryCursor    string `json:"queryCursor"`
	QueryOffset    string `json:"queryOffset"`
	FragmentCursor string `json:"fragmentCursor"`
	FragmentOffset string `json:"fragmentOffset"`
}

func (p *HoudiniSvelte) DefaultConfig(ctx context.Context) (PluginConfig, error) {
	// we need to determine if the user is using the plugin in a kit or svelte project
	// to do that let's look in the package.json for sveltekit as dependency
	pluginConfig, err := p.DB.PluginConfig(ctx)
	if err != nil {
		return PluginConfig{}, err
	}

	if pluginConfig.Framework == "" {
		// load the project config
		config, err := p.DB.ProjectConfig(ctx)
		if err != nil {
			return pluginConfig, err
		}

		packageJSON, err := afero.ReadFile(p.Fs, path.Join(config.ProjectRoot, "package.json"))
		if err != nil {
			return pluginConfig, err
		}

		// if the package.json references sveltekit, we are in a kit project
		if strings.Contains(string(packageJSON), "@sveltejs/kit") {
			pluginConfig.Framework = PluginFrameworkKit
		} else {
			pluginConfig.Framework = PluginFrameworkSvelte
		}
	}

	if pluginConfig.ClientPath == "" {
		pluginConfig.ClientPath = "./src/client"
	}

	if pluginConfig.CustomStores.Query == "" {
		pluginConfig.CustomStores.Query = "../runtime/stores/query.QueryStore"
	}

	if pluginConfig.CustomStores.Mutation == "" {
		pluginConfig.CustomStores.Mutation = "../runtime/stores/query.MutationStore"
	}

	if pluginConfig.CustomStores.Fragment == "" {
		pluginConfig.CustomStores.Fragment = "../runtime/stores/query.FragmentStore"
	}

	if pluginConfig.CustomStores.QueryCursor == "" {
		pluginConfig.CustomStores.QueryCursor = "../runtime/stores/query.QueryStoreCursor"
	}

	if pluginConfig.CustomStores.QueryOffset == "" {
		pluginConfig.CustomStores.QueryOffset = "../runtime/stores/query.QueryStoreOffset"
	}

	if pluginConfig.CustomStores.FragmentOffset == "" {
		pluginConfig.CustomStores.FragmentOffset = "../runtime/stores/query.FragmentStoreOffset"
	}

	if pluginConfig.CustomStores.FragmentCursor == "" {
		pluginConfig.CustomStores.FragmentCursor = "../runtime/stores/query.FragmentStoreCursor"
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
	clientPath := path.Join(projectConfig.ProjectRoot, pluginConfig.ClientPath)

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
