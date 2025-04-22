package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
)

func (p *HoudiniCore) Generate(ctx context.Context) error {
	// the first thing to do is generate the artifacts
	err := artifacts.Generate(ctx, p.DB, p.Fs)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
