package componentFields_test

import (
	"fmt"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins/tests"
)

func TestComponentFields_testTransform(t *testing.T) {
	// print hello
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query { 
        user: User  
      }

      type User {
        firstName: String
        avatar(size: Int): String! 
      }
    `,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "no args",
				Input: []string{
					`
              fragment UserAvatar on User 
                @componentField(field: "Avatar", prop: "user") 
                @arguments(size: { type: "Int" })
              {
                avatar(size: $size)
              }
          `,
					`
              query UserInfo {
                  user {
                    Avatar
                  }
              }
          `,
				},
				Pass: true,
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(fmt.Sprintf(`
            query UserInfo {
              user {
                ...%s
                __typename
              }
            }
          `, schema.ComponentFieldFragmentName("User", "Avatar"))),
				},
			},
			{
				Name: "with args",
				Input: []string{
					`
              fragment UserAvatar on User 
                @componentField(field: "Avatar", prop: "user") 
                @arguments(size: { type: "Int" })
              {
                avatar(size: $size)
              }
          `,
					`
              query UserInfo {
                  user {
                    Avatar(size: 100)
                  }
              }
          `,
				},
				Pass: true,
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(fmt.Sprintf(`
            query UserInfo {
              user {
                ...%s @with(size: 100)
                __typename
              }
            }
          `, schema.ComponentFieldFragmentName("User", "Avatar"))),
				},
			},
		},
	})
}
