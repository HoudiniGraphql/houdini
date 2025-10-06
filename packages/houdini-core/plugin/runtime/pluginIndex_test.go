package runtime_test

import (
	"context"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtime"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginIndexGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `type Query { hello: String }`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "generates index file",
				Pass: true,
			},
		},
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			assert.Nil(t, err)

			// run the transform
			err = runtime.GeneratePluginIndex(context.Background(), plugin.DB, plugin.Fs)
			require.Nil(t, err)

			// read the index contents
			indexContent, err := afero.ReadFile(plugin.Fs,
				path.Join(config.ProjectRoot, config.RuntimeDir, "plugins", "index.js"),
			)
			require.Nil(t, err)

			require.Equal(
				t,
				`export * from "../runtime/client/plugins/index.js"`,
				string(indexContent),
			)

			// read the type definition contents
			indexDTsContent, err := afero.ReadFile(plugin.Fs,
				path.Join(config.ProjectRoot, config.RuntimeDir, "plugins", "index.d.ts"),
			)
			require.Nil(t, err)
			require.Equal(
				t,
				`export * from "../runtime/client/plugins/index.js"`,
				string(indexDTsContent),
			)
		},
	})
}
