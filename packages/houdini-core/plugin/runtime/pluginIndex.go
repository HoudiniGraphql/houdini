package runtime

import (
	"context"
	"path/filepath"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func GeneratePluginIndex(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) error {
	// the goal of this generator is to create a plugins directory in the root of the
	// runtime that exports everything inside of runtime/client/plugins
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	indexPath := filepath.Join(config.ProjectRoot, config.RuntimeDir, "plugins", "index.ts")

	content := `export * from "../runtime/plugins/index.js"`

	// make sure the direcotry exists
	err = fs.MkdirAll(filepath.Dir(indexPath), 0o755)
	if err != nil {
		return err
	}

	// write the file contents
	err = afero.WriteFile(fs, indexPath, []byte(content), 0o644)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
