package fragmentArguments_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/fragmentArguments"
	"code.houdinigraphql.com/plugins/tests"
)

func TestFragmentArgumentTransform(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Query {
        user: User!
        users(name: String): [User!]!
      }

      type User {
        firstName: String!
        friends(name: String, limit: Int, offset: Int): [User!]!
        friendsByNames(names: [String!]): [User!]!
        id: ID!
      }
    `,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Threads query arguments onto fragment",
				Pass: true,
				Input: []string{
					`
          query AllUsers($name: String) {
            user {
              ...UserInfo @with(name: $name)
            }
          }
          `,
					`
            fragment UserInfo on User
              @arguments(name: {type: "String!"} ) {
                  friends(name: $name) {
                      firstName
                  }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            query AllUsers($name: String)  {
              user {
                id
                __typename
                ...UserInfo_4E9dx0 @with(name: $name)
              }
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_4E9dx0 on User {
              friends(name: $name) {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `).WithVariables(tests.ExpectedOperationVariable{
						Name:          "name",
						Type:          "String",
						TypeModifiers: "!",
					}),
			},
		},
		{
			Name: "Passes argument values to generated fragments",
				Pass: true,
				Input: []string{
					`
            query AllUsers {
              user {
                ...UserInfo @with(name: "Hello")
              }
            }
          `,
					`
            fragment UserInfo on User
              @arguments(name: {type: "String!"} ) {
                  friends(name: $name) {
                      firstName
                  }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            query AllUsers {
              user {
                id
                __typename
                ...UserInfo_g8N34 @with(name: "Hello")
              }
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_g8N34 on User {
              friends(name: "Hello") {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `),
				},
			},
			{
				Name: "Process fragment documents",
				Pass: true,
				Input: []string{
					`
            fragment ParentInfo on User {
              test: firstName
              ...UserInfo @with(name: "Hello")
            }
          `,
					`
            fragment UserInfo on User
              @arguments(name: {type: "String!"} ) {
                  friends(name: $name) {
                      firstName
                  }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            fragment ParentInfo on User {
              __typename
              id
              test: firstName
              ...UserInfo_g8N34 @with(name: "Hello")
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_g8N34 on User {
              friends(name: "Hello") {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `),
				},
			},
			{
				Name: "Arguments to directives on field with args",
				Pass: true,
				Input: []string{
					`
            fragment ParentInfo on User {
              ...UserInfo @with(name: "Hello")
            }
          `,
					`
            fragment UserInfo on User
            @arguments(name: {type: "String!"} ) {
            friends(name:"John") @deprecated(reason: $name) {
                firstName
              }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            fragment ParentInfo on User {
              __typename
              id
              ...UserInfo_g8N34 @with(name: "Hello")
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_g8N34 on User {
                friends(name:"John") @deprecated(reason: "Hello") {
                    firstName
                    id
                    __typename
                }
                id
                __typename
            }
          `),
				},
			},
			{
				Name: "Arguments to directives on field without args",
				Pass: true,
				Input: []string{
					`
            fragment ParentInfo on User {
              ...UserInfo @with(name: "Hello")
            }
          `,
					`
            fragment UserInfo on User
            @arguments(name: {type: "String!"} ) {
            friends @deprecated(reason: $name) {
                firstName
              }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            fragment ParentInfo on User {
              __typename
              id
              ...UserInfo_g8N34 @with(name: "Hello")
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_g8N34 on User {
                friends @deprecated(reason: "Hello") {
                    firstName
                    id
                    __typename
                }
                id
                __typename
            }
          `),
				},
			},

			{
				Name: "Multiple arguments",
				Pass: true,
				Input: []string{
					`
            fragment ParentInfo on User {
              ...UserInfo @with(name: "Hello", name2: "Goodbye")
            }
          `,
					`
            fragment UserInfo on User
            @arguments(name: {type: "String!"}, name2: {type: "String!"} ) {
              friendsOne: friends(name: $name) {
                firstName
              }
              friendsTwo: friends(name: $name2) {
                firstName
              }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            fragment ParentInfo on User {
              __typename
              id
              ...UserInfo_3TzIqS @with(name: "Hello")
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_3TzIqS on User {
              friendsOne: friends(name: "Hello") {
                firstName
                id
                __typename
              }
              friendsTwo: friends(name: "Goodbye") {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `),
				},
			},
			{
				Name: "Multiple documents",
				Pass: true,
				Input: []string{
					`
            fragment ParentInfo on User {
              friends {
                ...FriendInfo @with(name: "FriendInfo")
              }
              ...UserInfo @with(name: "UserInfo")
            }
          `,
					`
            fragment UserInfo on User @arguments(name: {type: "String!"}) {
              friends(name: $name) {
                firstName
              }
            }
          `,
					`
            fragment FriendInfo on User @arguments(name: {type: "String!"}) {
              friends(name: $name) {
                firstName
              }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            fragment ParentInfo on User {
              friends {
                __typename
                id
                ...FriendInfo_4xzoz7 @with(name: "FriendInfo")
              }
              __typename
              id
              ...UserInfo_C1c2a @with(name: "UserInfo")
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_C1c2a on User {
              friends(name: "UserInfo") {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `),
					tests.ExpectedDoc(`
            fragment FriendInfo_4xzoz7 on User {
              friends(name: "FriendInfo") {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `),
				},
			},
			{
				Name: "Same fragment with same arguments used in multiple documents",
				Pass: true,
				Input: []string{
					`query FirstQuery { user { ...UserInfo @with(name: "Hello") } }`,
					`query SecondQuery { user { ...UserInfo @with(name: "Hello") } }`,
					`fragment UserInfo on User @arguments(name: {type: "String!"}) { friends(name: $name) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query FirstQuery { user { ...UserInfo_g8N34 @with(name: "Hello") id __typename } }`,
					),
					tests.ExpectedDoc(
						`query SecondQuery { user { ...UserInfo_g8N34 @with(name: "Hello") id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment UserInfo_g8N34 on User { friends(name: "Hello") { firstName id __typename } id __typename  }`,
					),
				},
			},
			{
				Name: "Default value is inlined when arg omitted from @with",
				Pass: true,
				Input: []string{
					`query Q($limit: Int!) { user { ...F @with(limit: $limit) } }`,
					`fragment F on User @arguments(limit: {type: "Int!"}, offset: {type: "Int", default: 5}) { friends(limit: $limit, offset: $offset) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($limit: Int!) { user { ...F_2quo11 @with(limit: $limit) __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_2quo11 on User { friends(limit: $limit, offset: 5) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "limit", Type: "Int", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Omitting a defaulted arg and passing the same value explicitly produce the same clone",
				Pass: true,
				Input: []string{
					`query Implicit($limit: Int!) { user { ...F @with(limit: $limit) } }`,
					`query Explicit($limit: Int!) { user { ...F @with(limit: $limit, offset: 5) } }`,
					`fragment F on User @arguments(limit: {type: "Int!"}, offset: {type: "Int", default: 5}) { friends(limit: $limit, offset: $offset) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Implicit($limit: Int!) { user { ...F_2quo11 @with(limit: $limit) __typename id } }`,
					),
					tests.ExpectedDoc(
						`query Explicit($limit: Int!) { user { ...F_2quo11 @with(limit: $limit, offset: 5) __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_2quo11 on User { friends(limit: $limit, offset: 5) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "limit", Type: "Int", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Mixed literal and variable args in the same @with",
				Pass: true,
				Input: []string{
					`query Q($userName: String!) { user { ...F @with(name: $userName, limit: 10) } }`,
					`fragment F on User @arguments(name: {type: "String!"}, limit: {type: "Int!"}) { friends(name: $name, limit: $limit) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($userName: String!) { user { ...F_1CaZGl @with(name: $userName, limit: 10) __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_1CaZGl on User { friends(name: $userName, limit: 10) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "name", Type: "String", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Same fragment spread twice with different literal values produces distinct clones",
				Pass: true,
				Input: []string{
					`query Q { user { friendsA: friends { ...F @with(name: "alice") } friendsB: friends { ...F @with(name: "bob") } } }`,
					`fragment F on User @arguments(name: {type: "String!"}) { friends(name: $name) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q { user { friendsA: friends { ...F_4p6st7 @with(name: "alice") __typename id } friendsB: friends { ...F_16H5UA @with(name: "bob") __typename id } __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_4p6st7 on User { friends(name: "alice") { firstName id __typename } id __typename }`,
					),
					tests.ExpectedDoc(
						`fragment F_16H5UA on User { friends(name: "bob") { firstName id __typename } id __typename }`,
					),
				},
			},
			{
				Name: "List literal argument is inlined into the clone",
				Pass: true,
				Input: []string{
					`query Q { user { ...F @with(names: ["alice", "bob"]) } }`,
					`fragment F on User @arguments(names: {type: "[String!]!"}) { friendsByNames(names: $names) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q { user { ...F_TXXm0 @with(names: ["alice", "bob"]) __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_TXXm0 on User { friendsByNames(names: ["alice", "bob"]) { firstName id __typename } id __typename }`,
					),
				},
			},
			{
				Name: "String default value is inlined when arg omitted from @with",
				Pass: true,
				Input: []string{
					`query Q($limit: Int!) { user { ...F @with(limit: $limit) } }`,
					`fragment F on User @arguments(limit: {type: "Int!"}, name: {type: "String", default: "all"}) { friends(name: $name, limit: $limit) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($limit: Int!) { user { ...F_3qSBKq @with(limit: $limit) __typename id } }`,
					),
					tests.ExpectedDoc(
						`fragment F_3qSBKq on User { friends(name: "all", limit: $limit) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "limit", Type: "Int", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Argument variable can have arbitrary name",
				Pass: true,
				Input: []string{
					`query Info($userName: String!) { user { ...UserInfo @with(name: $userName) } }`,
					`fragment UserInfo on User @arguments(name: {type: "String!"}) { friends(name: $name) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Info($userName: String!) { user { ...UserInfo_qDNpv @with(name: $userName) id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment UserInfo_qDNpv on User { friends(name: $userName) { firstName id __typename } id __typename  }`,
					).WithVariables(tests.ExpectedOperationVariable{
						Name:          "name",
						Type:          "String",
						TypeModifiers: "!",
					}),
				},
			},
			{
				Name: "Mixed same-name and renamed variable arguments",
				Pass: true,
				Input: []string{
					`query Q($shared: String!, $renamed: String!) { user { ...F @with(a: $shared, b: $renamed) } }`,
					`fragment F on User @arguments(a: {type: "String!"}, b: {type: "String!"}) { friendsA: friends(name: $a) { firstName } friendsB: friends(name: $b) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($shared: String!, $renamed: String!) { user { ...F_3fkJCt @with(a: $shared, b: $renamed) id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment F_3fkJCt on User { friendsA: friends(name: $shared) { firstName id __typename } friendsB: friends(name: $renamed) { firstName id __typename } id __typename }`,
					).WithVariables(
						tests.ExpectedOperationVariable{Name: "a", Type: "String", TypeModifiers: "!"},
						tests.ExpectedOperationVariable{Name: "b", Type: "String", TypeModifiers: "!"},
					),
				},
			},
			{
				Name: "Same fragment spread with two different variable names produces distinct clones",
				Pass: true,
				Input: []string{
					`query Q($x: String!, $y: String!) { user { ...F @with(name: $x) friends { ...F @with(name: $y) } } }`,
					`fragment F on User @arguments(name: {type: "String!"}) { friends(name: $name) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($x: String!, $y: String!) { user { ...F_bdaPf @with(name: $x) friends { ...F_2bkMuv @with(name: $y) id __typename } id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment F_bdaPf on User { friends(name: $x) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "name", Type: "String", TypeModifiers: "!"}),
					tests.ExpectedDoc(
						`fragment F_2bkMuv on User { friends(name: $y) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "name", Type: "String", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Fragment spreads fragment with variable argument",
				Pass: true,
				Input: []string{
					`query Q($name: String!) { user { ...Outer @with(name: $name) } }`,
					`fragment Outer on User @arguments(name: {type: "String!"}) { ...Inner @with(name: $name) }`,
					`fragment Inner on User @arguments(name: {type: "String!"}) { friends(name: $name) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($name: String!) { user { ...Outer_4E9dx0 @with(name: $name) id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment Outer_4E9dx0 on User { ...Inner_4E9dx0 @with(name: $name) id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "name", Type: "String", TypeModifiers: "!"}),
					tests.ExpectedDoc(
						`fragment Inner_4E9dx0 on User { friends(name: $name) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "name", Type: "String", TypeModifiers: "!"}),
				},
			},
			{
				Name: "Fragment spreads fragment with renamed variable argument",
				Pass: true,
				Input: []string{
					`query Q($userId: String!) { user { ...Outer @with(outerName: $userId) } }`,
					`fragment Outer on User @arguments(outerName: {type: "String!"}) { ...Inner @with(innerName: $outerName) }`,
					`fragment Inner on User @arguments(innerName: {type: "String!"}) { friends(name: $innerName) { firstName } }`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						`query Q($userId: String!) { user { ...Outer_2KfY5k @with(outerName: $userId) id __typename } }`,
					),
					tests.ExpectedDoc(
						`fragment Outer_2KfY5k on User { ...Inner_1YmyDS @with(innerName: $userId) id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "outerName", Type: "String", TypeModifiers: "!"}),
					tests.ExpectedDoc(
						`fragment Inner_1YmyDS on User { friends(name: $userId) { firstName id __typename } id __typename }`,
					).WithVariables(tests.ExpectedOperationVariable{Name: "innerName", Type: "String", TypeModifiers: "!"}),
				},
			},
		},
	})
}

func TestFragmentArgumentTransform_multipleRuns(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
      type Query {
        user: User!
        users(name: String): [User!]!
      }

      type User {
        firstName: String!
        friends(name: String): [User!]!
        id: ID!
      }
    `,
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// extract twice
			err := plugin.AfterExtract(context.Background())
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			err = plugin.AfterValidate(context.Background())
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}
			err = fragmentArguments.Transform(context.Background(), plugin.DB)
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			// make sure the expected document is correct
			tests.ValidateExpectedDocuments(t, plugin.DB, test.Expected)
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Multiple runs",
				Pass: true,
				Input: []string{
					`
          query AllUsers($name: String) {
            user {
              ...UserInfo @with(name: $name)
            }
          }
          `,
					`
            fragment UserInfo on User
              @arguments(name: {type: "String!"} ) {
                  friends(name: $name) {
                      firstName
                  }
            }
          `,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(`
            query AllUsers($name: String)  {
              user {
                id
                __typename
                ...UserInfo_4E9dx0 @with(name: $name)
              }
            }
          `),
					tests.ExpectedDoc(`
            fragment UserInfo_4E9dx0 on User {
              friends(name: $name) {
                firstName
                id
                __typename
              }
              id
              __typename
            }
          `).WithVariables(
						tests.ExpectedOperationVariable{
							Name:          "name",
							Type:          "String",
							TypeModifiers: "!",
						},
					),
			},
		},
	},
	})
}
