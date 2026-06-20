package lists_test

import (
	"fmt"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	core "code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
	"code.houdinigraphql.com/plugins/tests"
)

func TestRefetchableDocumentGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *core.HoudiniCore]{
		Schema: `
			type Query {
				node(id: ID!): Node
				user: User
				legend(title: String!): Legend
			}

			type User implements Node {
				id: ID!
				firstName: String!
				field(filter: String): String
			}

			type Legend {
				title: String!
				name: String!
			}

			interface Node {
				id: ID!
			}
		`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "embeds a refetchable fragment in a query keyed by id",
				Pass: true,
				Input: []string{
					`
						fragment UserInfo on User @refetchable {
							firstName
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($id: ID!) {
								node(id: $id) {
									...UserInfo @mask_disable
									__typename
									id
								}
							}
						`,
							graphql.FragmentPaginationQueryName("UserInfo"),
						)).WithVariables(
						tests.ExpectedOperationVariable{
							Name:          "id",
							Type:          "ID",
							TypeModifiers: "!",
						},
					),
				},
			},
			{
				Name: "forwards @arguments through @with on the embedded query",
				Pass: true,
				Input: []string{
					`
						fragment UserInfo on User @refetchable @arguments(filter: { type: "String" }) {
							field(filter: $filter)
						}
					`,
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($filter: String, $id: ID!) {
								node(id: $id) {
									...UserInfo_3Wbh3 @mask_disable @with(filter: $filter)
									__typename
									id
								}
							}
						`,
							graphql.FragmentPaginationQueryName("UserInfo"),
						)).WithVariables(
						tests.ExpectedOperationVariable{
							Name: "filter",
							Type: "String",
						},
						tests.ExpectedOperationVariable{
							Name:          "id",
							Type:          "ID",
							TypeModifiers: "!",
						},
					),
				},
			},
			{
				Name: "embeds via a custom resolve query keyed by the type's keys",
				Pass: true,
				Input: []string{
					`
						fragment LegendInfo on Legend @refetchable {
							name
						}
					`,
				},
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.TypeConfig["Legend"] = plugins.TypeConfig{
						Keys:         []string{"title"},
						ResolveQuery: "legend",
					}
				},
				Expected: []tests.ExpectedDocument{
					tests.ExpectedDoc(
						fmt.Sprintf(`
							query %s($title: String!) {
								legend(title: $title) {
									...LegendInfo @mask_disable
									__typename
									title
								}
							}
						`,
							graphql.FragmentPaginationQueryName("LegendInfo"),
						)).WithVariables(
						tests.ExpectedOperationVariable{
							Name:          "title",
							Type:          "String",
							TypeModifiers: "!",
						},
					),
				},
			},
		},
	})
}
