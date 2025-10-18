package generate_test

import (
	"context"
	"fmt"
	"path"
	"testing"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
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
					Query:          "$houdini/plugins/houdini-svelte/runtime/stores/query.QueryStore",
					QueryOffset:    "$houdini/plugins/houdini-svelte/runtime/stores/query.QueryStoreOffset",
					QueryCursor:    "$houdini/plugins/houdini-svelte/runtime/stores/query.QueryStoreCursor",
					Fragment:       "$houdini/plugins/houdini-svelte/runtime/stores/fragment.FragmentStore",
					FragmentOffset: "$houdini/plugins/houdini-svelte/runtime/stores/fragment.FragmentStoreOffset",
					FragmentCursor: "$houdini/plugins/houdini-svelte/runtime/stores/fragment.FragmentStoreCursor",
					Mutation:       "$houdini/plugins/houdini-svelte/runtime/stores/mutation.MutationStore",
					Subscription:   "$houdini/plugins/houdini-svelte/runtime/stores/subscription.SubscriptionStore",
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

			// run the document generator first
			_, err = plugin.GenerateDocuments(ctx)
			require.NoError(t, err)

			// the goal now is to look at the generated store files and make sure
			// it matches expectations
			for name, expected := range test.Extra {
				// read the generated store file
				storePath := path.Join(
					config.PluginDirectory("houdini-svelte"),
					"stores",
					name,
				)
				contents, err := afero.ReadFile(plugin.Filesystem(), storePath+".js")
				require.NoError(t, err)
				require.Equal(t, expected, string(contents))

				// and make sue the type definition was generated as well
				exists, err := afero.Exists(
					plugin.Filesystem(),
					storePath+".d.ts",
				)
				require.NoError(t, err)
				require.True(
					t,
					exists,
					"expected type definition to be generated for store %s",
					name,
				)
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
						import artifact from '$houdini/artifacts/TestMutation1'
						import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

						export class TestMutation1Store extends MutationStore {
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
					`subscription TestSubscription2 { newUser { id } }`,
				},
				Extra: map[string]any{
					"TestSubscription1": tests.Dedent(`
						import artifact from '$houdini/artifacts/TestSubscription1'
						import type { TestSubscription1$input, $TestSubscription1$result } from '$houdini/artifacts/TestSubscription1'
						import { SubscriptionStore } from '$houdini/plugins/houdini-svelte/runtime/stores/subscription'

						export class TestSubscription1Store extends SubscriptionStore<TestSubscription1$result, $TestSubscription1$input> {
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
						import { FragmentStore } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment'
						import artifact from '$houdini/artifacts/TestFragment'

						export class TestFragmentStore extends FragmentStore {
							constructor() {
								super({
									artifact,
									storeName: "TestFragmentStore",
									variables: false,
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
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
						import artifact from '$houdini/artifacts/TestQuery'

						export class TestQueryStore extends QueryStore {
							constructor() {
								super({
									artifact,
									storeName: "TestQueryStore",
									variables: false,
								})
							}
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
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
						import artifact from '$houdini/artifacts/TestQuery'

						export class TestQueryStore extends QueryStore {
							constructor() {
								super({
									artifact,
									storeName: "TestQueryStore",
									variables: true,
								})
							}
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
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
						import artifact from '$houdini/artifacts/TestQuery'

						export class TestQueryStore extends QueryStore {
							constructor() {
								super({
									artifact,
									storeName: "TestQueryStore",
									variables: false,
								})
							}
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
						import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
						import artifact from '$houdini/artifacts/TestQuery'

						export class TestQueryStore extends QueryStore {
							constructor() {
								super({
									artifact,
									storeName: "TestQueryStore",
									variables: false,
								})
							}
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
							import { QueryStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/TestQuery'

							export class TestQueryStore extends QueryStoreCursor {
								constructor() {
									super({
										artifact,
										storeName: "TestQueryStore",
										variables: false,
									})
								}
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
							import { QueryStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/TestQuery'

							export class TestQueryStore extends QueryStoreCursor {
								constructor() {
									super({
										artifact,
										storeName: "TestQueryStore",
										variables: false,
									})
								}
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
							import { QueryStoreOffset } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/TestQuery'

							export class TestQueryStore extends QueryStoreOffset {
								constructor() {
									super({
										artifact,
										storeName: "TestQueryStore",
										variables: false,
									})
								}
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
							import { FragmentStore } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment'
							import artifact from '$houdini/artifacts/TestFragment'

							export class TestFragmentStore extends FragmentStore {
								constructor() {
									super({
										artifact,
										storeName: "TestFragmentStore",
										variables: false,
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
						import { FragmentStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment'
						import artifact from '$houdini/artifacts/TestFragment'
						import _PaginationArtifact from '$houdini/artifacts/%s'

						export class TestFragmentStore extends FragmentStoreCursor {
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
						import { FragmentStoreCursor } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment'
						import artifact from '$houdini/artifacts/TestFragment'
						import _PaginationArtifact from '$houdini/artifacts/%s'

						export class TestFragmentStore extends FragmentStoreCursor {
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
						import { FragmentStoreOffset } from '$houdini/plugins/houdini-svelte/runtime/stores/fragment'
						import artifact from '$houdini/artifacts/TestFragment'
						import _PaginationArtifact from '$houdini/artifacts/%s'

						export class TestFragmentStore extends FragmentStoreOffset {
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
