package plugin

import (
	"context"

	"golang.org/x/sync/errgroup"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtime"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
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

	// by now, we have all of the necessary metadata written to the database to run the other generationsin parallel
	g, ctx := errgroup.WithContext(ctx)

	// generate the documents file
	g.Go(func() error {
		documentFiles, err := documents.GeneratePersistentQueries(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}
		generated = append(generated, documentFiles...)
		return nil
	})

	// generate definitions files (schema.graphql, documents.gql, enums)
	g.Go(func() error {
		err = schema.GenerateDefinitionFiles(ctx, p.DB, p.Fs, false)
		if err != nil {
			return err
		}

		return nil
	})

	// generate the runtime index file
	g.Go(func() error {
		updated, err := runtime.GenerateIndexFile(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}

		generated = append(generated, updated...)
		return nil
	})

	err = g.Wait()
	if err != nil {
		return nil, err
	}

	// we're done
	return generated, nil
}
