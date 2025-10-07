package plugin

import (
	"context"
	"path"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtime"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
)

func (p *HoudiniCore) GenerateRuntime(ctx context.Context) ([]string, error) {
	config, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	g, ctx := errgroup.WithContext(ctx)

	generated := plugins.ThreadSafeSlice[string]{}

	// generate the documents file
	g.Go(func() error {
		documentFiles, err := documents.GeneratePersistentQueries(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}
		generated.Append(documentFiles...)
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

	// generate the type definitions for the imperative cache
	g.Go(func() error {
		files, err := runtime.GenerateImperativeCacheTypeDefs(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}

		generated.Append(files...)

		return nil
	})

	// generate the plugin index file
	g.Go(func() error {
		err = runtime.GeneratePluginIndex(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}

		return nil
	})
	// generate the runtime index file
	g.Go(func() error {
		targetPath := path.Join(config.ProjectRoot, config.RuntimeDir, "index.js")

		// before we generate the index file let's look at its current content
		existingContent := ""
		// if the existing content is the same, then there's nothing to do
		if exists, err := afero.Exists(p.Fs, targetPath); err == nil && exists {
			existingContentByte, err := afero.ReadFile(p.Fs, targetPath)
			if err != nil {
				return err
			}
			existingContent = string(existingContentByte)

			// we can delete the file now
			err = p.Fs.Remove(targetPath)
			if err != nil {
				return err
			}
		}

		err := runtime.GenerateRuntimeIndexFile(ctx, p.DB, p.Fs)
		if err != nil {
			return err
		}

		// notify any other plugins its their turn to modify the index file
		// we do this in series so that file locks aren't a problem
		_, err = plugins.TriggerHookSerial(ctx, p.DB, "IndexFile", map[string]any{})
		if err != nil {
			return err
		}

		// now we should read the content back
		updated, err := afero.ReadFile(p.Fs, targetPath)
		if err != nil {
			return err
		}

		// if the content changed then we need to mark it as invalid
		if existingContent != string(updated) {
			generated.Append(targetPath)
		}

		return nil
	})

	err = g.Wait()
	if err != nil {
		return nil, err
	}

	// we're done
	return generated.GetItems(), nil
}

func (p *HoudiniCore) IncludeRuntime(ctx context.Context) (string, error) {
	return "runtime", nil
}

func (p *HoudiniCore) TransformRuntime(
	ctx context.Context,
	filepath string,
	content string,
) (string, error) {
	// we need the project config to check for paths
	config, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return "", err
	}

	return runtime.TransformRuntime(ctx, p.DB, config, filepath, content)
}
