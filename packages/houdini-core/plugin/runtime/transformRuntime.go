package runtime

import (
	"context"
	"fmt"
	"path"
	fp "path/filepath"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func TransformRuntime(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	config plugins.ProjectConfig,
	filepath string,
	content string,
) (string, error) {
	runtimeDir := path.Join(config.ProjectRoot, config.RuntimeDir, "runtime")

	// certain files get special treatment
	switch filepath {

	// the SITE_URL needs to be expanded
	case path.Join(runtimeDir, "lib", "constants.js"):
		return strings.ReplaceAll(content, "SITE_URL", "https://houdinigraphql.com"), nil

	// plugins can add extra config to the project's runtime config
	case path.Join(runtimeDir, "imports", "pluginConfig.js"):
		return extraConfig(ctx, db, content)

	// we need to add an import to the config file
	case path.Join(runtimeDir, "imports", "config.js"):
		configPath, err := fp.Rel(path.Join(runtimeDir, "imports"), config.Filepath)
		if err != nil {
			return "", err
		}

		return fmt.Sprintf(`import projectConfig from "%s";
export default projectConfig;
`, configPath), nil

		// add any client plugins specified by codegen plugins
	case path.Join(runtimeDir, "client", "plugins", "injectedPlugins.js"):
		return injectedPlugins(content, db, config)
	}

	return content, nil
}

func extraConfig(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	content string,
) (string, error) {
	// plugins can register a module that exports a function that modifies the config file
	// this means we need to search for every plugin with a config_module column and
	// export a value that contains the registered function
	plugins := []string{}

	// grab a connection from the pool
	conn, err := db.Take(ctx)
	if err != nil {
		return "", err
	}
	defer db.Put(conn)

	// a query to look for all plugins with a config module
	pluginSearch, err := conn.Prepare(`
		SELECT config_module FROM plugins WHERE config_module IS NOT NULL
	`)
	if err != nil {
		return content, err
	}
	defer pluginSearch.Finalize()

	// build up the list of plugins we care about
	err = db.StepStatement(ctx, pluginSearch, func() {
		plugins = append(plugins, pluginSearch.GetText("config_module"))
	})
	if err != nil {
		return content, err
	}

	// if there are no plugins with a config module we don't have to transform anything
	if len(plugins) == 0 {
		return content, nil
	}

	// if we got this far we have plugins with a specified config module
	pluginImports := []string{}
	pluginValues := []string{}
	for i, plugin := range plugins {
		pluginImports = append(pluginImports, fmt.Sprintf(`import plugin_%v from "%s"`, i, plugin))
		pluginValues = append(pluginValues, fmt.Sprintf(`plugin_%v`, i))
	}

	return fmt.Sprintf(`
%s

export default [
%s
]
	`, strings.Join(pluginImports, "\n"), strings.Join(pluginValues, ", \n")), nil
}

func injectedPlugins(
	content string,
	db plugins.DatabasePool[config.PluginConfig],
	config plugins.ProjectConfig,
) (string, error) {
	return content, nil
}
