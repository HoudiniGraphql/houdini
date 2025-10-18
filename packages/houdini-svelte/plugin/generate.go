package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/generate"
)

func (p *HoudiniSvelte) GenerateDocuments(ctx context.Context) ([]string, error) {
	return generate.GenerateStores(ctx, p.DB, p.Fs)
}
