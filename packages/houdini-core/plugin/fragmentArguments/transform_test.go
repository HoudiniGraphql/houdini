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
		},
	})
}
