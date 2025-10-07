package typescript

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
)

func GenerateDocumentTypeDefs(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDefinitions *collected.Documents,
	fs afero.Fs,
) ([]string, error) {
	return nil, nil
}
