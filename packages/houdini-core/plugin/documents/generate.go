package documents

import (
	"context"
	"path"

	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/typescript"
	"code.houdinigraphql.com/plugins"
)

func Generate(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	sortKeys bool,
) ([]string, error) {
	conn, err := db.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	// before we generate artifacts we need to trigger a few hooks
	_, err = plugins.TriggerHookParallel(ctx, db, "Hash", map[string]any{})
	if err != nil {
		return nil, err
	}

	// the first thing we need to do is collect the definitions of all of the necessary documents
	collected, err := collected.CollectDocuments(ctx, db, conn, sortKeys)
	if err != nil {
		return nil, err
	}

	//  make sure that the documents are printed
	err = artifacts.EnsureDocumentsPrinted(ctx, db, conn, collected, false)
	if err != nil {
		return nil, err
	}

	// make sure the artifact directory exists
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	artifactDirectory := path.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")
	err = fs.MkdirAll(artifactDirectory, 0755)
	if err != nil {
		return nil, err
	}

	// we can generate the artifacts and type definitions in parallel
	group, ctx := errgroup.WithContext(ctx)
	fps := plugins.ThreadSafeSlice[string]{}

	group.Go(func() error {
		files, err := typescript.GenerateDocumentTypeDefs(ctx, db, conn, collected, fs)
		if err != nil {
			return err
		}
		fps.Append(files...)
		return nil
	})

	group.Go(func() error {
		files, err := artifacts.GenerateDocumentArtifacts(ctx, db, conn, collected, fs, sortKeys)
		if err != nil {
			return err
		}
		fps.Append(files...)
		return nil
	})

	err = group.Wait()
	if err != nil {
		return nil, err
	}

	// we now have everything we need to generate the document artifacts
	return fps.GetItems(), nil
}
