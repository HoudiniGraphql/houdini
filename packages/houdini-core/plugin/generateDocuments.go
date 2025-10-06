package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
)

func (p *HoudiniCore) GenerateDocuments(ctx context.Context) ([]string, error) {
	// the first thing to do is generate the artifacts
	return artifacts.Generate(ctx, p.DB, p.Fs, false)
}
