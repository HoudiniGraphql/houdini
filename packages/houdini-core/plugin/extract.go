package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
)

// ExtractDocuments is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func (p *HoudiniCore) ExtractDocuments(ctx context.Context) error {
	// if there is a task ID then we should only extract the raw documents for that task
	taskID := plugins.TaskIDFromContext(ctx)
	if taskID == nil {
		return documents.Walk(ctx, p.DB, p.Fs)
	}

	// TODO: extract task ID documents
	return documents.ExtractTaskDocuments(ctx, p.DB, p.Fs, *taskID)

}
