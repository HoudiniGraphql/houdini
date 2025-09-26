package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
)

func (p *HoudiniCore) Generate(ctx context.Context) ([]string, error) {
	// we need to build up the filepaths that we generate in this time
	generated := []string{}

	// the first thing to do is generate the artifacts
	files, err := artifacts.Generate(ctx, p.DB, p.Fs, false)
	if err != nil {
		return nil, err
	}
	generated = append(generated, files...)

	// generate the persisted queries document
	persistentQueryFiles, err := documents.GeneratePersistentQueries(ctx, p.DB, p.Fs)
	if err != nil {
		return nil, err
	}
	generated = append(generated, persistentQueryFiles...)

	// we're done
	return files, nil
}
