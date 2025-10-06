package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	fp "path/filepath"
	"sort"
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
		return ExtraConfig(ctx, db, content)

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
		return InjectPlugins(ctx, content, db)
	}

	return content, nil
}

func ExtraConfig(
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
		SELECT config_module FROM plugins WHERE config_module IS NOT NULL ORDER BY name
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

	return fmt.Sprintf(`%s

export default [
%s
]
`, strings.Join(pluginImports, "\n"), strings.Join(pluginValues, ",\n")), nil
}

func InjectPlugins(
	ctx context.Context,
	content string,
	db plugins.DatabasePool[config.PluginConfig],
) (string, error) {
	// we need to build up a list of all client plugins that need to be included
	// along with their configuration
	plugins := map[string]string{}

	// grab a connection from the pool
	conn, err := db.Take(ctx)
	if err != nil {
		return "", err
	}
	defer db.Put(conn)

	// a query to look for all plugins with a config module
	pluginSearch, err := conn.Prepare(`
		SELECT client_plugins FROM plugins WHERE client_plugins IS NOT NULL ORDER BY name 
	`)
	if err != nil {
		return content, err
	}
	defer pluginSearch.Finalize()

	// every row is a plugin that requires client plugins
	err = db.StepStatement(ctx, pluginSearch, func() {
		// grab the plugin name and config from the result
		config := map[string]any{}
		e := json.Unmarshal([]byte(pluginSearch.GetText("client_plugins")), &config)
		if e != nil {
			err = e
			return
		}

		// merge the config into the plugins map
		for key, value := range config {
			valueJSON, e := json.Marshal(value)
			if err != nil {
				err = e
			}
			plugins[key] = string(valueJSON)
		}
	})
	if err != nil {
		return content, err
	}

	// if we have no plugins to inject we can return the content as-is
	if len(plugins) == 0 {
		return content, nil
	}

	// build up the import statements and the values
	imports := []string{}
	values := []string{}

	// extract and sort keys for deterministic output
	keys := make([]string, 0, len(plugins))
	for k := range plugins {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// iterate in sorted order
	for i, key := range keys {
		value := plugins[key]
		imports = append(imports, fmt.Sprintf(`import plugin%v from "%s"`, i, key))
		values = append(values, fmt.Sprintf(`plugin%v(%s)`, i, value))
	}
	// build up the content
	result := fmt.Sprintf(`%s

const plugins = [
%s
]

export default plugins
`, strings.Join(imports, "\n"), strings.Join(values, ",\n"))

	return result, nil
}
