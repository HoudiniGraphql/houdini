package typescript_test

import (
	"context"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// when masking is disabled for a fragment spread (either with @mask_disable or
// defaultFragmentMasking: 'disable') the fragment's fields are part of the data
// the runtime returns, so they have to show up in the generated types too
func TestTypescriptFragmentMasking(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				user(id: ID): User!
				node(id: ID!): Node
			}

			interface Node {
				id: ID!
			}

			type User implements Node {
				id: ID!
				nickname: String
				age: Int
			}

			type Ghost implements Node {
				id: ID!
				aka: String!
			}
		`,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			for docName, expected := range test.Extra {
				typeDefs, err := afero.ReadFile(plugin.Fs, config.ArtifactTypePath(docName))
				require.NoError(t, err)
				require.Contains(t, string(typeDefs), expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "mask_disable inlines fragment fields",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						user(id: "1") {
							id
							...MaskUserInfo @mask_disable
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
						age
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly user: {
								readonly id: string;
								readonly nickname: string | null;
								readonly age: number | null;
								readonly " $fragments": {
									MaskUserInfo: {};
								};
							};
						};
					`),
				},
			},
			{
				Name: "mask_disable dedupes fields selected directly",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						user(id: "1") {
							id
							nickname
							...MaskUserInfo @mask_disable
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
						age
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly user: {
								readonly id: string;
								readonly nickname: string | null;
								readonly age: number | null;
								readonly " $fragments": {
									MaskUserInfo: {};
								};
							};
						};
					`),
				},
			},
			{
				Name: "fragment on an implemented interface is inlined",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						user(id: "1") {
							...MaskNodeInfo @mask_disable
						}
					}`,
					`fragment MaskNodeInfo on Node {
						id
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly user: {
								readonly id: string;
								readonly " $fragments": {
									MaskNodeInfo: {};
								};
							};
						};
					`),
				},
			},
			{
				Name: "narrower fragment on an abstract parent stays masked",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						node(id: "1") {
							id
							...MaskUserInfo @mask_disable
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly node: {
								readonly id: string;
								readonly " $fragments": {
									MaskUserInfo: {};
								};
							} | null;
						};
					`),
				},
			},
			{
				Name: "spread inside an inline fragment is inlined into the branch",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						node(id: "1") {
							... on User {
								id
								...MaskUserInfo @mask_disable
							}
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						readonly nickname: string | null;
					`),
				},
			},
			{
				Name: "nested spreads inline into fragment data types",
				Pass: true,
				Input: []string{
					`query MaskQuery {
						user(id: "1") {
							...MaskUserInfo
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
						...MaskUserAge @mask_disable
					}`,
					`fragment MaskUserAge on User {
						age
					}`,
				},
				Extra: map[string]any{
					"MaskUserInfo": tests.Dedent(`
						export type MaskUserInfo$data = {
							readonly nickname: string | null;
							readonly age: number | null;
							readonly " $fragments": {
								MaskUserAge: {};
							};
						};
					`),
				},
			},
			{
				Name: "conditionally included spreads are typed optional",
				Pass: true,
				Input: []string{
					`query MaskQuery($show: Boolean!) {
						user(id: "1") {
							id
							nickname
							...MaskUserInfo @mask_disable @include(if: $show)
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
						age
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly user: {
								readonly id: string;
								readonly nickname: string | null;
								readonly age?: number | null;
								readonly " $fragments": {
									MaskUserInfo: {};
								};
							};
						};
					`),
				},
			},
			{
				Name: "defaultFragmentMasking disable inlines without a directive",
				Pass: true,
				ProjectConfig: func(config *plugins.ProjectConfig) {
					config.DefaultFragmentMasking = false
				},
				Input: []string{
					`query MaskQuery {
						user(id: "1") {
							id
							...MaskUserInfo
							...MaskUserAge @mask_enable
						}
					}`,
					`fragment MaskUserInfo on User {
						nickname
					}`,
					`fragment MaskUserAge on User {
						age
					}`,
				},
				Extra: map[string]any{
					"MaskQuery": tests.Dedent(`
						export type MaskQuery$result = {
							readonly user: {
								readonly id: string;
								readonly nickname: string | null;
								readonly " $fragments": {
									MaskUserInfo: {};
									MaskUserAge: {};
								};
							};
						};
					`),
				},
			},
		},
	})
}

// when several unmasked fragments select the same field with different
// sub-selections the generated type has to describe the union of every
// occurrence's children, not just the first one (issue #1727)
func TestTypescriptMaskDisableMerging(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				item: Item!
			}

			type Item {
				id: ID!
				meta: Meta!
				details: Detail
			}

			type Meta {
				label: String!
				color: String!
			}

			union Detail = TextDetail | ImageDetail

			type TextDetail {
				id: ID!
				text: String!
				meta: Meta!
			}

			type ImageDetail {
				id: ID!
				url: String!
			}
		`,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			for docName, expected := range test.Extra {
				typeDefs, err := afero.ReadFile(plugin.Fs, config.ArtifactTypePath(docName))
				require.NoError(t, err)
				require.Contains(t, string(typeDefs), expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "overlapping object sub-selections are merged",
				Pass: true,
				Input: []string{
					`query MergeQuery {
						item {
							...ItemLabel @mask_disable
							...ItemColor @mask_disable
						}
					}`,
					`fragment ItemLabel on Item {
						meta {
							label
						}
					}`,
					`fragment ItemColor on Item {
						meta {
							color
						}
					}`,
				},
				Extra: map[string]any{
					"MergeQuery": tests.Dedent(`
						export type MergeQuery$result = {
							readonly item: {
								readonly meta: {
									readonly label: string;
									readonly color: string;
								};
								readonly " $fragments": {
									ItemLabel: {};
									ItemColor: {};
								};
							};
						};
					`),
				},
			},
			{
				Name: "a narrow union selection does not erase inline fragments",
				Pass: true,
				Input: []string{
					`query MergeQuery {
						item {
							...DetailType @mask_disable
							...DetailContent @mask_disable
						}
					}`,
					`fragment DetailType on Item {
						details {
							__typename
						}
					}`,
					`fragment DetailContent on Item {
						details {
							__typename
							... on TextDetail {
								text
							}
						}
					}`,
				},
				Extra: map[string]any{
					"MergeQuery": tests.Dedent(`
						readonly text: string;
					`),
				},
			},
			{
				Name: "diamond spreads emit a single fragment marker",
				Pass: true,
				Input: []string{
					`fragment DiamondA on Item {
						...DiamondB @mask_disable
						...DiamondC @mask_disable
						meta {
							label
						}
					}`,
					`fragment DiamondB on Item {
						...DiamondC @mask_disable
						id
					}`,
					`fragment DiamondC on Item {
						details {
							__typename
						}
					}`,
				},
				Extra: map[string]any{
					"DiamondA": tests.Dedent(`
						export type DiamondA$data = {
							readonly details: {
								readonly __typename: string;
							} | null;
							readonly id: string;
							readonly meta: {
								readonly label: string;
							};
							readonly " $fragments": {
								DiamondB: {};
								DiamondC: {};
							};
						};
					`),
				},
			},
			{
				Name: "overlapping fields inside a union arm are merged",
				Pass: true,
				Input: []string{
					`query MergeQuery {
						item {
							...TextLabel @mask_disable
							...TextColor @mask_disable
						}
					}`,
					`fragment TextLabel on Item {
						details {
							... on TextDetail {
								meta {
									label
								}
							}
						}
					}`,
					`fragment TextColor on Item {
						details {
							... on TextDetail {
								meta {
									color
								}
							}
						}
					}`,
				},
				Extra: map[string]any{
					"MergeQuery": tests.Dedent(`
						export type MergeQuery$result = {
							readonly item: {
								readonly details: {} & (({
									readonly meta: {
										readonly label: string;
										readonly color: string;
									};
									readonly __typename: "TextDetail";
								}) | ({
									readonly " $fragments"?: {};
									readonly __typename: "non-exhaustive; don't match this";
								})) | null;
								readonly " $fragments": {
									TextLabel: {};
									TextColor: {};
								};
							};
						};
					`),
				},
			},
		},
	})
}

// @includeListID stamps an opaque __id onto the list value so the client can
// pass it back via @listID; the generated type must reflect that intersection
func TestTypescriptIncludeListID(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				users: [User!]!
			}

			type User implements Node {
				id: ID!
				name: String!
			}

			interface Node {
				id: ID!
			}
		`,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			for docName, expected := range test.Extra {
				typeDefs, err := afero.ReadFile(plugin.Fs, config.ArtifactTypePath(docName))
				require.NoError(t, err)
				require.Contains(t, string(typeDefs), expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "@includeListID intersects __id onto the list type",
				Pass: true,
				Input: []string{`query TestQuery {
					users @list(name: "All_Users") @includeListID {
						id
						name
					}
				}`},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						export type TestQuery$result = {
							readonly users: ({
								readonly id: string;
								readonly name: string;
							})[] & { __id: string };
						};
					`),
				},
			},
		},
	})
}
