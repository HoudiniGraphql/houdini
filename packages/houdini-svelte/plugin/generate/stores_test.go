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

type storeTestCase struct {
	Index    string // Expected JavaScript store implementation code
	IndexDTs string // Expected TypeScript type definitions for the store
}

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
			for name, expectedAny := range test.Extra {
				expected, ok := expectedAny.(storeTestCase)
				require.True(t, ok, "expected test case to be of type storeTestCase for store %s", name)

				storePath := path.Join(
					config.PluginDirectory("houdini-svelte"),
					"stores",
					name,
				)

				// read and validate the generated JavaScript store file
				jsContents, err := afero.ReadFile(plugin.Filesystem(), storePath+".js")
				require.NoError(t, err)
				require.Equal(t, expected.Index, string(jsContents), "JavaScript store content mismatch for %s", name)

				// read and validate the generated TypeScript definition file
				dtsContents, err := afero.ReadFile(plugin.Filesystem(), storePath+".d.ts")
				require.NoError(t, err)
				require.Equal(t, expected.IndexDTs, string(dtsContents), "TypeScript definition content mismatch for %s", name)
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
					"TestMutation1": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
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
					"TestSubscription1": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/TestSubscription1'
							import { SubscriptionStore } from '$houdini/plugins/houdini-svelte/runtime/stores/subscription'

							export class TestSubscription1Store extends SubscriptionStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "basic fragment store",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User { id }`,
				},
				Extra: map[string]any{
					"TestFragment": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "basic query store",
				Pass: true,
				Input: []string{
					`query TestQuery { version }`,
				},
				Extra: map[string]any{
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "query store with required variables",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int!) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "query store with nullable variables",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "query store with non-null variables with default value",
				Pass: true,
				Input: []string{
					`query TestQuery($intValue: Int! = 2) { usersByOffset(offset: $intValue) { id } }`,
				},
				Extra: map[string]any{
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
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
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
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
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
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
					"TestQuery": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "fragment pagination",
				Pass: true,
				Input: []string{
					`fragment TestFragment on User { id }`,
				},
				Extra: map[string]any{
					"TestFragment": storeTestCase{
						Index: tests.Dedent(`
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
						IndexDTs: ``,
					},
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
					"TestFragment": storeTestCase{
						Index: tests.Dedent(fmt.Sprintf(`
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
						IndexDTs: ``,
					},
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
					"TestFragment": storeTestCase{
						Index: tests.Dedent(fmt.Sprintf(`
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
						IndexDTs: ``,
					},
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
					"TestFragment": storeTestCase{
						Index: tests.Dedent(fmt.Sprintf(`
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
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "query with list and mutation with discovered lists",
				Pass: true,
				Input: []string{
					`query AllUsers { users { id name } }`,
					`mutation AddUser($name: String!) { addUser(name: $name) { id name } }`,
				},
				Extra: map[string]any{
					"AllUsers": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/AllUsers'

							export class AllUsersStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "AllUsersStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"AddUser": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/AddUser'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class AddUserStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "multiple queries with lists and mutations for discovered list validation",
				Pass: true,
				Input: []string{
					`query UserList { users { id name } }`,
					`query UsersByOffset { usersByOffset(limit: 10) { id name } }`,
					`mutation CreateUser($name: String!) { addUser(name: $name) { id name } }`,
					`mutation UpdateUserMutation { updateUser { id name } }`,
				},
				Extra: map[string]any{
					"UserList": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/UserList'

							export class UserListStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "UserListStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"UsersByOffset": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/UsersByOffset'

							export class UsersByOffsetStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "UsersByOffsetStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"CreateUser": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/CreateUser'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class CreateUserStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"UpdateUserMutation": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/UpdateUserMutation'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class UpdateUserMutationStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "query with list and mutation with discovered lists",
				Pass: true,
				Input: []string{
					`query AllUsers { users { id name } }`,
					`mutation AddUser($name: String!) { addUser(name: $name) { id name } }`,
				},
				Extra: map[string]any{
					"AllUsers": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/AllUsers'

							export class AllUsersStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "AllUsersStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"AddUser": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/AddUser'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class AddUserStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
				},
			},
			{
				Name: "multiple queries with lists and mutations for discovered list validation",
				Pass: true,
				Input: []string{
					`query UserList { users { id name } }`,
					`query UsersByOffset { usersByOffset(limit: 10) { id name } }`,
					`mutation CreateUser($name: String!) { addUser(name: $name) { id name } }`,
					`mutation UpdateUserMutation { updateUser { id name } }`,
				},
				Extra: map[string]any{
					"UserList": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/UserList'

							export class UserListStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "UserListStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"UsersByOffset": storeTestCase{
						Index: tests.Dedent(`
							import { QueryStore } from '$houdini/plugins/houdini-svelte/runtime/stores/query'
							import artifact from '$houdini/artifacts/UsersByOffset'

							export class UsersByOffsetStore extends QueryStore {
								constructor() {
									super({
										artifact,
										storeName: "UsersByOffsetStore",
										variables: false,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"CreateUser": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/CreateUser'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class CreateUserStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
					"UpdateUserMutation": storeTestCase{
						Index: tests.Dedent(`
							import artifact from '$houdini/artifacts/UpdateUserMutation'
							import { MutationStore } from '$houdini/plugins/houdini-svelte/runtime/stores/mutation'

							export class UpdateUserMutationStore extends MutationStore {
								constructor() {
									super({
										artifact,
									})
								}
							}
						`),
						IndexDTs: ``,
					},
				},
			},
		},
	})
}
