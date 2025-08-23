package plugin

import (
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

type HoudiniSvelte struct {
	plugins.Plugin[PluginConfig]
	Fs afero.Fs
}

type PluginConfig = any

func (p *HoudiniSvelte) Name() string {
	return "houdini-svelte"
}

func (p *HoudiniSvelte) SetFs(fs afero.Fs) {
	p.Fs = fs
}

func (p *HoudiniSvelte) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}
