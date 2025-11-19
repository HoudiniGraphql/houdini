package plugins

import (
	"context"
	"path/filepath"

	"github.com/spf13/afero"
)

// CopyPluginRuntime handles both runtime copying and generation for a plugin.
// This function combines the logic that was previously split between the HTTP handler
// and the plugin's GenerateRuntime method.
func CopyPluginRuntime[PluginConfig any](
	ctx context.Context,
	plugin HoudiniPlugin[PluginConfig],
	fs afero.Fs,
) ([]string, error) {
	paths := []string{}

	// if the plugin defines a runtime to be included then we should include it now
	if includeRuntime, ok := plugin.(IncludeRuntime); ok {
		runtimeDir, err := includeRuntime.IncludeRuntime(ctx)
		if err != nil {
			return nil, err
		}

		config, err := plugin.Database().ProjectConfig(ctx)
		if err != nil {
			return nil, err
		}

		runtimePath := filepath.Join(PluginDirFromContext(ctx), runtimeDir)
		targetPath := config.PluginRuntimeDirectory(plugin.Name())

		// the plugin could have defined a transform for the runtime
		transform := func(ctx context.Context, source string, content string) (string, error) {
			return content, nil
		}
		if transformer, ok := plugin.(TransformRuntime); ok {
			transform = transformer.TransformRuntime
		}

		// copy the plugin runtime to the plugin runtime directory using afero.Fs
		updated, err := RecursiveCopy(ctx, fs, runtimePath, targetPath, transform)
		if err != nil {
			return nil, err
		}

		// add any updated paths to the list
		paths = append(paths, updated...)
	}

	if generate, ok := plugin.(GenerateRuntime); ok {
		filepaths, err := generate.GenerateRuntime(ctx)
		if err != nil {
			return nil, err
		}

		paths = append(paths, filepaths...)
	}

	// nothing went wrong
	return paths, nil
}
