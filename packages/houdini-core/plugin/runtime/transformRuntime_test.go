package runtime_test

import (
	"context"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtime"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/stretchr/testify/require"
)

func TestRuntimeTransform_extraConfig(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `type Query { hello: String }`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "injects config updaters into runtime",
			},
		},
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// before we run the transform, we need to insert a plugin into the database
			conn, err := plugin.DB.Take(context.Background())
			require.Nil(t, err)
			defer plugin.DB.Put(conn)

			insertPlugin, err := conn.Prepare(`
				INSERT INTO plugins 
					(name, port, hooks, plugin_order, config_module)
				VALUES 
					('test', 1234, '["ANYTHING"]', 'core', 'test1'),
				  ('test2', 1235, '["ANYTHING"]', 'core', 'test2')
			`)
			require.Nil(t, err)
			defer insertPlugin.Finalize()

			err = plugin.DB.ExecStatement(insertPlugin, map[string]any{})
			require.Nil(t, err)

			// run the transform
			result, err := runtime.ExtraConfig(context.Background(), plugin.DB, "old")
			require.Nil(t, err)

			expected := `import plugin_0 from "test1"
import plugin_1 from "test2"

export default [
plugin_0,
plugin_1
]
`
			require.Equal(t, expected, result)
		},
	})
}

func TestRuntimeTransform_injectedPlugins(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `type Query { hello: String }`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "injects plugins into the runtime config",
			},
		},
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// before we run the transform, we need to insert a plugin into the database
			conn, err := plugin.DB.Take(context.Background())
			require.Nil(t, err)
			defer plugin.DB.Put(conn)

			insertPlugin, err := conn.Prepare(`
				INSERT INTO plugins 
					(name, port, hooks, plugin_order, client_plugins)
				VALUES 
					('test', 1234, '["ANYTHING"]', 'core', '{"foo": {"bar": "baz"}}'),
				  ('test2', 1235, '["ANYTHING"]', 'core', '{"bing": {"bar": 1}, "quz": 1}')
			`)
			require.Nil(t, err)
			defer insertPlugin.Finalize()

			err = plugin.DB.ExecStatement(insertPlugin, map[string]any{})
			require.Nil(t, err)

			// run the transform
			result, err := runtime.InjectPlugins(context.Background(), "old", plugin.DB)
			require.Nil(t, err)

			expected := `import plugin0 from "bing"
import plugin1 from "foo"
import plugin2 from "quz"

const plugins = [
plugin0({"bar":1}),
plugin1({"bar":"baz"}),
plugin2(1)
]

export default plugins
`
			require.Equal(t, expected, result)
		},
	})
}
