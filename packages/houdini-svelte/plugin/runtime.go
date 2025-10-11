package plugin

import (
	"context"
	"path"

	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniSvelte) IncludeRuntime(ctx context.Context) (string, error) {
	return "runtime", nil
}

func (p *HoudiniSvelte) TransformRuntime(
	ctx context.Context,
	filepath string,
	content string,
) (string, error) {
	switch filepath {
	case path.Join(plugins.PluginDirFromContext(ctx), "runtime", "adapter.js"):
	default:
		return content, nil
	}
}
