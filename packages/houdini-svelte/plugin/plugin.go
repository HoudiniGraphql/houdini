package plugin

import (
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins"
)

type HoudiniSvelte struct {
	plugins.Plugin[config.PluginConfig]
}

func (p *HoudiniSvelte) Name() string {
	return "houdini-svelte"
}

func (p *HoudiniSvelte) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}
