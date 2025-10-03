package plugin

import (
	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

type HoudiniReact struct {
	plugins.Plugin[config.PluginConfig]
	Fs afero.Fs
}

func (p *HoudiniReact) Name() string {
	return "houdini-react"
}

func (p *HoudiniReact) SetFs(fs afero.Fs) {
	p.Fs = fs
}

func (p *HoudiniReact) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}
