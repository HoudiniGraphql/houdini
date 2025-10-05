package runtime_test

import (
	"context"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIndexFileGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `type Query { hello: String }`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "generates index file",
				Pass: true,
				Input: []string{
					`query TestQuery { hello }`,
					`fragment TestFragment on Query { hello }`,
				},
			},
		},
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			assert.Nil(t, err)

			// read the index contents
			contents, err := afero.ReadFile(plugin.Fs,
				path.Join(config.ProjectRoot, config.RuntimeDir, "index.js"),
			)
			require.Nil(t, err)

			require.Equal(t, `
export * from './runtime/client'
export * from './runtime'
export * from './graphql/index.js'
export { default as TestFragment} from './artifacts/TestFragment.js'
export { default as TestQuery} from './artifacts/TestQuery.js'
`, string(contents))
		},
	})
}
