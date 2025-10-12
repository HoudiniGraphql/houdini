package plugin

import (
	"context"
	"path"
	"strings"

	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

var Framework = "svelte"

type HoudiniSvelte struct {
	plugins.Plugin[PluginConfig]
	Fs           afero.Fs
	PluginConfig PluginConfig
}

func (p *HoudiniSvelte) Name() string {
	return "houdini-svelte"
}

func (p *HoudiniSvelte) SetFs(fs afero.Fs) {
	p.Fs = fs
}

func (p *HoudiniSvelte) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}

func (p *HoudiniSvelte) AfterLoad(ctx context.Context) error {
	// we need to determine if the user is using the plugin in a kit or svelte project
	// to do that let's look in the package.json for sveltekit as dependency
	pluginConfig, err := p.DB.PluginConfig(ctx)
	if err != nil {
		return err
	}

	if pluginConfig.Framework != "" {
		Framework = pluginConfig.Framework
		return nil
	} else {

		// load the project config
		config, err := p.DB.ProjectConfig(ctx)
		if err != nil {
			return err
		}

		// read the contents
		packageJSON, err := afero.ReadFile(p.Fs, path.Join(config.ProjectRoot, "package.json"))
		if err != nil {
			return err
		}

		// if the package.json references sveltekit, we are in a kit project
		if strings.Contains(string(packageJSON), "@sveltejs/kit") {
			Framework = "kit"
		}
	}

	return nil
}

type PluginFramework = string

const (
	PluginFrameworkSvelte = "svelte"
	PluginFrameworkKit    = "kit"
)

type PluginConfig struct {
	Framework PluginFramework `json:"framework"`
}
