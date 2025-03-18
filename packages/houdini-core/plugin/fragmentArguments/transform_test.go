package fragmentArguments_test

import (
	"testing"

	"code.houdinigraphql.com/plugins/tests"
)

func TestFragmentArgumentTransform(t *testing.T) {
	tests.RunTable(t, tests.Table{
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
		Tests: []tests.Test{
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
		},
	})
}
