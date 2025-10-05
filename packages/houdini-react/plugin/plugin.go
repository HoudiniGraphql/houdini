package plugin

import (
	"context"

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

func (p *HoudiniReact) IncludeRuntime(ctx context.Context) (string, error) {
	// the runtime direcotory is contained in the runtime directory in the root of the package
	return "runtime", nil
}
