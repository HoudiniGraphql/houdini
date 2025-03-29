package selection

import (
	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

// CollectDocuments takes a document ID and grabs its full selection set along with the selection sets of
// all referenced fragments
func CollectDocuments(db *plugins.DatabasePool[config.PluginConfig]) map[string]CollectedDocument {
	return nil
}
