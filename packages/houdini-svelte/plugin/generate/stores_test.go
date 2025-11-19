package generate_test

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestGenerateStores(t *testing.T) {
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
				version: String!
				usersByOffset(limit: Int, offset: Int): [User!]!
				usersByForwardsCursor(first: Int, after: String): UserConnection!
				usersByBackwardsCursor(last: Int, before: String): UserConnection!
				users: [User!]!
			}

			type Mutation {
				updateUser: User!
				addUser(name: String!): User!
			}

			type Subscription {
				newUser: User!
			}

			type User implements Node {
				id: ID!
				name: String!
				friendsConnection(first: Int, after: String, last: Int, before: String): UserConnection!
				friendsList(limit: Int, offset: Int): [User!]!
			}

			type UserConnection {
				edges: [UserEdge!]!
				pageInfo: PageInfo!
			}

			type UserEdge {
				node: User!
				cursor: String!
			}

			interface Node {
				id: ID!
			}

			type PageInfo {
				hasNextPage: Boolean!
				hasPreviousPage: Boolean!
				startCursor: String
				endCursor: String
			}
		`,
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			ctx := context.Background()
			config, err := plugin.DB.ProjectConfig(ctx)
			require.NoError(t, err)

			// Create the core runtime files that UpdateIndexFiles expects to read
			projectRuntimePath := filepath.Join(config.ProjectRoot, config.RuntimeDir, "runtime")
			err = plugin.Fs.MkdirAll(projectRuntimePath, 0755)
			require.NoError(t, err)

			// Create the core runtime index file that UpdateIndexFiles expects
			coreIndexContent := `export function graphql<_Payload, _Result = _Payload>(str: string): _Result;
export * from './stores'
export * from './client'
export * from './fragments'
export * from './session'
export * from './adapter'
export * from './types'
`
			err = afero.WriteFile(plugin.Fs, filepath.Join(projectRuntimePath, "index.ts"), []byte(coreIndexContent), 0644)
			require.NoError(t, err)

			// Create the plugin runtime source files that CopyPluginRuntime expects to copy
			runtimeSourcePath := filepath.Join("packages", "houdini-svelte", "runtime")
			err = plugin.Fs.MkdirAll(runtimeSourcePath, 0755)
			require.NoError(t, err)

			// Create plugin-specific runtime files
			pluginIndexContent := `export * from './stores'
export * from './client'
`
			err = afero.WriteFile(plugin.Fs, filepath.Join(runtimeSourcePath, "index.ts"), []byte(pluginIndexContent), 0644)
			require.NoError(t, err)

			// Use the proper runtime generation function that includes runtime copying
			ctx = plugins.ContextWithPluginDir(ctx, "packages/houdini-svelte")
			_, err = plugins.CopyPluginRuntime(ctx, plugin, plugin.Fs)
			require.NoError(t, err)

			// the goal now is to look at the generated store files and make sure
			// it matches expectations
			for name, expected := range test.Extra {
				// read the generated store file
				storePath := filepath.Join(
					config.PluginDirectory("houdini-svelte"),
					"stores",
					name,
				)
				contents, err := afero.ReadFile(plugin.Filesystem(), storePath+".ts")
				require.NoError(t, err)
				require.Equal(t, expected, string(contents))
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "mutations",
				Pass: true,
				Input: []string{
					`mutation TestMutation1 { updateUser { id }  }`,
					`mutation TestMutation2 { updateUser { id }  }`,
				},
				Extra: map[string]any{
					"TestMutation1": tests.Dedent(`
						import artifact from '$houdini/artifacts/TestMutation1.js'
						import type { TestMutation1$result, TestMutation1$input, TestMutation1$optimistic } from '$houdini/artifacts/TestMutation1.js'
						import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation.js'

						export class TestMutation1Store extends MutationStore<TestMutation1$result, TestMutation1$input, TestMutation1$optimistic> {
						    constructor() {
						        super({
						            artifact,
						        })
						    }
						}
					`),
				},
			},
			{
				Name: "subscriptions",
				Pass: true,
				Input: []string{
					`subscription TestSubscription1 { newUser { id } }`,
				},
				Extra: map[string]any{
					"TestSubscription1": tests.Dedent(`
						import artifact from '$houdini/artifacts/TestSubscription1.js'
						import type { TestSubscription1$result, TestSubscription1$input }from '$houdini/artifacts/TestSubscription1.js'
						import { SubscriptionStore } from '$houdini/plugins/houdini-svelte/runtime/stores/subscription.js'

						export class TestSubscription1Store extends SubscriptionStore<TestSubscription1$result, TestSubscription1$input> {
						    constructor() {
						        super({
						            artifact,
						        })
						    }
						}
					`),
				},
			},
			{
				Name: "basic fragment store",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User { id }`,
				},
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
						import { FragmentStore } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment.js'
						import artifact from '$houdini/artifacts/TestFragment.js'
						import type { TestFragment$data, TestFragment$input } from '$houdini/artifacts/TestFragment.js'

						export class TestFragmentStore extends FragmentStore<TestFragment$data, { TestFragment: any }, TestFragment$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestFragmentStore",
						        })
						    }
						}

					`),
				},
			},
			{
				Name: "basic query store",
				Pass: true,
				Input: []string{
					`query TestQuery { version }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						import type { QueryStoreFetchParams } from '$houdini'
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
						import artifact from '$houdini/artifacts/TestQuery.js'
						import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

						export class TestQueryStore extends QueryStore<TestQuery$result, TestQuery$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestQueryStore",
						            variables: false,
						        })
						    }
						}

						export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
						    const store = new TestQueryStore()
						    await store.fetch(params)
						    return { TestQuery: store }
						}
					`),
				},
			},
			{
				Name: "query store with required variables",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int!) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						import type { QueryStoreFetchParams } from '$houdini'
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
						import artifact from '$houdini/artifacts/TestQuery.js'
						import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

						export class TestQueryStore extends QueryStore<TestQuery$result, TestQuery$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestQueryStore",
						            variables: true,
						        })
						    }
						}

						export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
						    const store = new TestQueryStore()
						    await store.fetch(params)
						    return { TestQuery: store }
						}
					`),
				},
			},
			{
				Name: "query store with nullable variables",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						import type { QueryStoreFetchParams } from '$houdini'
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
						import artifact from '$houdini/artifacts/TestQuery.js'
						import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

						export class TestQueryStore extends QueryStore<TestQuery$result, TestQuery$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestQueryStore",
						            variables: false,
						        })
						    }
						}

						export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
						    const store = new TestQueryStore()
						    await store.fetch(params)
						    return { TestQuery: store }
						}
					`),
				},
			},
			{
				Name: "query store with non-null variables with default value",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int! = 2) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						import type { QueryStoreFetchParams } from '$houdini'
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
						import artifact from '$houdini/artifacts/TestQuery.js'
						import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

						export class TestQueryStore extends QueryStore<TestQuery$result, TestQuery$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestQueryStore",
						            variables: false,
						        })
						    }
						}

						export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
						    const store = new TestQueryStore()
						    await store.fetch(params)
						    return { TestQuery: store }
						}
					`),
				},
			},
			{
				Name: "forward cursor pagination",
				Pass: true,
				Input: []string{
					`query TestQuery {
							usersByForwardsCursor(first: 10) @paginate {
								edges {
									node {
										id
									}
								}
							}
						}`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
							import type { QueryStoreFetchParams } from '$houdini'
							import { QueryStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
							import artifact from '$houdini/artifacts/TestQuery.js'
							import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

							export class TestQueryStore extends QueryStoreCursor<TestQuery$result, TestQuery$input> {
							    constructor() {
							        super({
							            artifact,
							            storeName: "TestQueryStore",
							            variables: false,
							        })
							    }
							}

							export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
							    const store = new TestQueryStore()
							    await store.fetch(params)
							    return { TestQuery: store }
							}
						`),
				},
			},
			{
				Name: "backwards cursor pagination",
				Pass: true,
				Input: []string{
					`query TestQuery {
							usersByBackwardsCursor(last: 10) @paginate {
								edges {
									node {
										id
									}
								}
							}
						}`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
							import type { QueryStoreFetchParams } from '$houdini'
							import { QueryStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
							import artifact from '$houdini/artifacts/TestQuery.js'
							import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

							export class TestQueryStore extends QueryStoreCursor<TestQuery$result, TestQuery$input> {
							    constructor() {
							        super({
							            artifact,
							            storeName: "TestQueryStore",
							            variables: false,
							        })
							    }
							}

							export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
							    const store = new TestQueryStore()
							    await store.fetch(params)
							    return { TestQuery: store }
							}
						`),
				},
			},
			{
				Name: "offset pagination",
				Pass: true,
				Input: []string{
					`query TestQuery {
							usersByOffset(limit: 10) @paginate {
								id
							}
						}`,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
							import type { QueryStoreFetchParams } from '$houdini'
							import { QueryStoreOffset } from '$houdini/plugins/houdini-svelte/runtime/stores/query.js'
							import artifact from '$houdini/artifacts/TestQuery.js'
							import type { TestQuery$result, TestQuery$input } from '$houdini/artifacts/TestQuery.js'

							export class TestQueryStore extends QueryStoreOffset<TestQuery$result, TestQuery$input> {
							    constructor() {
							        super({
							            artifact,
							            storeName: "TestQueryStore",
							            variables: false,
							        })
							    }
							}

							export async function load_TestQuery(params: QueryStoreFetchParams<TestQuery$result, TestQuery$input>): Promise<{TestQuery: TestQueryStore}>{
							    const store = new TestQueryStore()
							    await store.fetch(params)
							    return { TestQuery: store }
							}
					`),
				},
			},
			{
				Name: "fragment pagination",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User { id }`,
				},
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
							import { FragmentStore } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment.js'
							import artifact from '$houdini/artifacts/TestFragment.js'
							import type { TestFragment$data, TestFragment$input } from '$houdini/artifacts/TestFragment.js'

							export class TestFragmentStore extends FragmentStore<TestFragment$data, { TestFragment: any }, TestFragment$input> {
							    constructor() {
							        super({
							            artifact,
							            storeName: "TestFragmentStore",
							        })
							    }
							}
						`),
				},
			},
			{
				Name: "fragment with forward cursor pagination",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User {
							friendsConnection(first: 10) @paginate {
								edges {
									node {
										id
									}
								}
							}
						}`,
				},
				Extra: map[string]any{
					"TestFragment": tests.Dedent(fmt.Sprintf(`
						import { FragmentStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment.js'
						import artifact from '$houdini/artifacts/TestFragment.js'
						import type { TestFragment$data, TestFragment$input } from '$houdini/artifacts/TestFragment.js'
						import _PaginationArtifact from '$houdini/artifacts/%s.js'

						export class TestFragmentStore extends FragmentStoreCursor<TestFragment$data, { TestFragment: any }, TestFragment$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestFragmentStore",
						            variables: true,
						            paginationArtifact: _PaginationArtifact,
						        })
						    }
						}

					`,
						graphql.FragmentPaginationQueryName("TestFragment"))),
				},
			},
			{
				Name: "fragment with backwards cursor pagination",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User {
							friendsConnection(last: 10) @paginate {
								edges {
									node {
										id
									}
								}
							}
						}`,
				},
				Extra: map[string]any{
					"TestFragment": tests.Dedent(fmt.Sprintf(`
						import { FragmentStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment.js'
						import artifact from '$houdini/artifacts/TestFragment.js'
						import type { TestFragment$data, TestFragment$input } from '$houdini/artifacts/TestFragment.js'
						import _PaginationArtifact from '$houdini/artifacts/%s.js'

						export class TestFragmentStore extends FragmentStoreCursor<TestFragment$data, { TestFragment: any }, TestFragment$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestFragmentStore",
						            variables: true,
						            paginationArtifact: _PaginationArtifact,
						        })
						    }
						}

					`,
						graphql.FragmentPaginationQueryName("TestFragment"))),
				},
			},
			{
				Name: "fragment with offset pagination",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User {
							friendsList(limit: 10) @paginate {
								id
								name
							}
						}`,
				},
				Extra: map[string]any{
					"TestFragment": tests.Dedent(fmt.Sprintf(`
						import { FragmentStoreOffset } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment.js'
						import artifact from '$houdini/artifacts/TestFragment.js'
						import type { TestFragment$data, TestFragment$input } from '$houdini/artifacts/TestFragment.js'
						import _PaginationArtifact from '$houdini/artifacts/%s.js'

						export class TestFragmentStore extends FragmentStoreOffset<TestFragment$data, { TestFragment: any }, TestFragment$input> {
						    constructor() {
						        super({
						            artifact,
						            storeName: "TestFragmentStore",
						            variables: true,
						            paginationArtifact: _PaginationArtifact,
						        })
						    }
						}

					`,
						graphql.FragmentPaginationQueryName("TestFragment"))),
				},
			},
		},
	})
}
