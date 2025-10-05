package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniCore) Generate(ctx context.Context) ([]string, error) {
	// we need to build up the filepaths that we generate in this time
	generated := plugins.ThreadSafeSlice[string]{}

	// the first thing to do is generate the artifacts
	files, err := artifacts.Generate(ctx, p.DB, p.Fs, false)
	if err != nil {
		return nil, err
	}
	generated.Append(files...)

	// we're done
	return generated.GetItems(), nil
}
