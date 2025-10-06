package runtime

import (
	"context"
	"path"
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

	indexPath := path.Join(config.ProjectRoot, config.RuntimeDir, "plugins", "index.js")
	dtsPath := path.Join(config.ProjectRoot, config.RuntimeDir, "plugins", "index.d.ts")

	// both files get the same contents
	content := `export * from "../runtime/client/plugins/index.js"`

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
	err = afero.WriteFile(fs, dtsPath, []byte(content), 0o644)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
