package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
)

// ExtractDocuments is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func (p *HoudiniCore) ExtractDocuments(ctx context.Context) error {
	return documents.Walk(ctx, p.DB, p.Fs)
}
