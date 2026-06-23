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
	// the runtime directory is contained in the runtime directory in the root of the package
	return "runtime", nil
}

func (p *HoudiniReact) ClientPlugins(ctx context.Context) (map[string]any, error) {
	return map[string]any{
		"$houdini/plugins/houdini-react/runtime/clientPlugin": nil,
		// @session is React-only, so its mint-token relay is injected here rather than
		// added to the shared core client pipeline (which Svelte/kit also run). The path
		// points at the core runtime module copied into the user's $houdini/runtime.
		"$houdini/runtime/plugins/sessionRelay": nil,
	}, nil
}

// AfterGenerate runs after both GenerateDocuments and GenerateRuntime complete,
// ensuring artifacts exist before we inject React-specific types into them.
func (p *HoudiniReact) AfterGenerate(ctx context.Context) error {
	_, err := p.InjectComponentFieldArtifactTypes(ctx)
	return err
}
