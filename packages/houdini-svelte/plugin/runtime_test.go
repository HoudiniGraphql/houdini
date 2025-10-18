package plugin_test

import (
	"context"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestRuntime_graphqlTag(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniSvelte]{
		Schema: `type Query { hello: String }`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "injects config updaters into runtime",
				Input: []string{
					`query MyQuery { hello }`,
					`query YourQuery { hello }`,
				},
			},
		},
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.Nil(t, err)

			// before we run the transform, we need to insert a plugin into the database
			conn, err := plugin.DB.Take(context.Background())
			require.Nil(t, err)
			defer plugin.DB.Put(conn)

			// prepare the .d.ts file that will be transformed
			targetPath := path.Join(
				config.ProjectRoot,
				config.RuntimeDir,
				"runtime",
				"index.d.ts",
			)
			oldContent := []byte(`
export declare function graphql<_Payload, _Result = _Payload>(str: TemplateStringsArray): _Result;
`)
			afero.WriteFile(plugin.Fs, targetPath, []byte(oldContent), 0644)

			// run the generator
			_, err = plugin.GenerateRuntime(context.Background())
			require.Nil(t, err)

			// read the transformed file
			found, err := afero.ReadFile(plugin.Fs, targetPath)
			require.NoError(t, err)

			expected := []byte(`
import type MyQueryStore from '$houdini/plugins/houdini-svelte/stores/MyQuery'
import type YourQueryStore from '$houdini/plugins/houdini-svelte/stores/YourQuery'

export function graphql(str: "query YourQuery { hello }"): YourQueryStore;
export function graphql(str: "query MyQuery { hello }"): MyQueryStore;
export declare function graphql<_Payload, _Result = _Payload>(str: TemplateStringsArray): _Result;
`)
			require.Equal(t, expected, found)
		},
	})
}
