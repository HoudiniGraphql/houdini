package plugin

import (
	"code.houdinigraphql.com/plugins"
)

type HoudiniSvelte struct {
	plugins.Plugin[PluginConfig]
}

func (p *HoudiniSvelte) Name() string {
	return "houdini-svelte"
}

func (p *HoudiniSvelte) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}
