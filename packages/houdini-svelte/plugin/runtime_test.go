package plugin_test

import (
	"context"
	"path/filepath"
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
			targetPath := filepath.Join(
				config.ProjectRoot,
				config.RuntimeDir,
				"runtime",
				"index.ts",
			)
			oldContent := []byte(
				`export function graphql<_Payload, _Result = _Payload>(str: string): _Result;
`,
			)
			afero.WriteFile(plugin.Fs, targetPath, []byte(oldContent), 0644)

			// run the generator
			_, err = plugin.UpdateIndexFiles(context.Background())
			require.Nil(t, err)

			// read the transformed file
			found, err := afero.ReadFile(plugin.Fs, targetPath)
			require.NoError(t, err)

			expected := `
import type { MyQueryStore } from '$houdini/plugins/houdini-svelte/stores/MyQuery'
import type { YourQueryStore } from '$houdini/plugins/houdini-svelte/stores/YourQuery'

export function graphql(str: ` + "`" + `query MyQuery { hello }` + "`" + `): MyQueryStore;
export function graphql(str: ` + "`" + `query YourQuery { hello }` + "`" + `): YourQueryStore;
export function graphql<_Payload, _Result = _Payload>(str: string): _Result;
`
			require.Equal(t, expected, string(found))
		},
	})
}

func TestRuntime_fragments(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniSvelte]{
		Plugin: tests.Plugin[config.PluginConfig]{
			Name:           "houdini-svelte",
			IncludeRuntime: "runtime",
			Config: config.PluginConfig{
				CustomStores: config.PluginConfigStorePaths{
					Query:          "$houdini/plugins/houdini-svelte/runtime/stores/query.js#QueryStore",
					QueryOffset:    "$houdini/plugins/houdini-svelte/runtime/stores/query.js#QueryStoreOffset",
					QueryCursor:    "$houdini/plugins/houdini-svelte/runtime/stores/query.js#QueryStoreCursor",
					Fragment:       "$houdini/plugins/houdini-svelte/runtime/stores/fragment.js#FragmentStore",
					FragmentOffset: "$houdini/plugins/houdini-svelte/runtime/stores/fragment.js#FragmentStoreOffset",
					FragmentCursor: "$houdini/plugins/houdini-svelte/runtime/stores/fragment.js#FragmentStoreCursor",
					Mutation:       "$houdini/plugins/houdini-svelte/runtime/stores/mutation.js#MutationStore",
					Subscription:   "$houdini/plugins/houdini-svelte/runtime/stores/subscription.js#SubscriptionStore",
				},
			},
		},

		Schema: `
			type Query { 
				viewer: User
			}

			type User { 
				id: ID!
			}

			type UserEdge { 
				cursor: String!
				node: User
			}

			type UserConnection { 
				edges: [UserEdge!]!
				pageInfo: PageInfo!
			}

			type PageInfo {
				startCursor: String
				endCursor: String
				hasNextPage: Boolean!
				hasPreviousPage: Boolean!
			}
		`,
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			// the goal now is to look at the generated store files and make sure
			// it matches expectations
			for _, expected := range test.Extra {
				config, err := plugin.DB.ProjectConfig(context.Background())
				require.Nil(t, err)

				// before we run the transform, we need to insert a plugin into the database
				conn, err := plugin.DB.Take(context.Background())
				require.Nil(t, err)
				defer plugin.DB.Put(conn)

				// prepare the .d.ts file that will be transformed
				targetPath := filepath.Join(
					config.PluginRuntimeDirectory(plugin.Name()),
					"fragments.ts",
				)
				oldContent := []byte(`
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment,
	fragment: FragmentStore<_Fragment['shape'], {}>
): Readable<Exclude<_Fragment['shape'], undefined>> & {
	data: Readable<_Fragment>
	artifact: FragmentArtifact
}`)
				err = afero.WriteFile(plugin.Fs, targetPath, []byte(oldContent), 0644)
				require.NoError(t, err)

				// run the generator
				_, err = plugin.GenerateFragmentTypeDefs(context.Background())
				require.Nil(t, err)

				// read the transformed file
				found, err := afero.ReadFile(plugin.Fs, targetPath)
				require.NoError(t, err)

				require.Equal(t, expected, string(found))
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "standard fragments",
				Pass: true,
				Input: []string{
					`fragment TestFragment on Query { viewer { id } }`,
				},
				Extra: map[string]any{
					"_": tests.Dedent(`
						import { TestFragment$input, TestFragment$data } from "$houdini/artifacts/TestFragment";
						import { TestFragmentStore } from "$houdini/plugins/houdini-svelte/stores/TestFragment";

						export function fragment(
								initialValue: {
										" $fragments": {
												TestFragment: any;
										};
								} | {
										"__typename": "non-exhaustive; don't match this";
								},
								document: TestFragmentStore
						): FragmentStoreInstance<TestFragment$data, TestFragment$input>;
						export function fragment(
								initialValue: {
										" $fragments": {
												TestFragment: any;
										};
								} | null | undefined | {
										"__typename": "non-exhaustive; don't match this";
								},
								document: TestFragmentStore
						): FragmentStoreInstance<TestFragment$data | null, TestFragment$input>;
						export function fragment<_Fragment extends Fragment<any>>(
							ref: _Fragment,
							fragment: FragmentStore<_Fragment['shape'], {}>
						): Readable<Exclude<_Fragment['shape'], undefined>> & {
							data: Readable<_Fragment>
							artifact: FragmentArtifact
						}
					`),
				},
			},
		},
	})
}
