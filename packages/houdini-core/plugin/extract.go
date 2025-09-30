package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
)

// ExtractDocuments is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func (p *HoudiniCore) ExtractDocuments(
	ctx context.Context,
	input plugins.ExtractDocumentsInput,
) error {
	// if we were given a specific path to extract, do that
	if len(input.Filepaths) > 0 {
		return documents.ExtractFromFilepaths(ctx, p.DB, p.Fs, input.Filepaths)
	}
	// there is no task id, just walk the full filesystem
	return documents.Walk(ctx, p.DB, p.Fs)
}
