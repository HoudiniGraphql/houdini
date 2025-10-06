package runtime

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func GenerateGraphQLReturnTypes(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) error {
	return nil
}
