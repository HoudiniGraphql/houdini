package runtime

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func GenerateImperativeCacheTypeDefs(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) ([]string, error) {
	return nil, nil
}
