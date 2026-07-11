package runtime_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestGenerateImperativeCacheTypeDefs(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			enum MyEnum {
				Hello
			}

			type Query {
				user(id: ID, filter: UserFilter, filterList: [UserFilter!], enumArg: MyEnum): User
				users(
					filter: UserFilter,
					list: [UserFilter!]!,
					id: ID!
					firstName: String!
					admin: Boolean
					age: Int
					weight: Float
				): [User]
				nodes: [Node!]!
				entities: [Entity]
				entity: Entity!
				listOfLists: [[User]]!
				node(id: ID!): Node
			}

			type Mutation {
				doThing(
					filter: UserFilter,
					list: [UserFilter!]!,
					id: ID!
					firstName: String!
					admin: Boolean
					age: Int
					weight: Float
				): User
			}

			input UserFilter {
				middle: NestedUserFilter
				listRequired: [String!]!
				nullList: [String]
				recursive: UserFilter
				enum: MyEnum
			}

			input NestedUserFilter {
				id: ID!
				firstName: String!
				admin: Boolean
				age: Int
				weight: Float
			}

			interface Node {
				id: ID!
			}

			type Cat implements Node & Animal {
				id: ID!
				kitty: Boolean!
				isAnimal: Boolean!
				names: [String]!
			}


			interface Animal {
				isAnimal: Boolean!
			}

			union Entity = User | Cat

			union AnotherEntity = User | Ghost

			type Ghost implements Node {
				id: ID!
				aka: String!
				name: String!
			}

			type User implements Node {
				id: ID!

				firstName(pattern: String): String!
				nickname: String
				parent: User
				friends: [User]
				enumValue: MyEnum

				admin: Boolean
				age: Int
				weight: Float
			}
		`,
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "happy path",
				Pass: true,
				Input: []string{
					`query TestQuery {
							users(
								id: "1"
								firstName: "hello"
								list: []
							) @list(name: "All_Users") {
								firstName
							}
						}
					`,
					`query TestQueryNoArgs {
							entities @list(name: "NoArgs") {
								... on User {
									firstName
								}
							}
						}
					`,
					`fragment UserInfo on User {
							firstName
						}
					`,
					`fragment UserInfoWithArguments on User
						@arguments(pattern: { type: "String" })
						{
							firstName(pattern: $pattern)
						}
					`,
				},
			},
		},
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			expected := tests.Dedent(`
				import type { Record } from "./public/record";
				import type { TestQuery$result, TestQuery$input, TestQuery$artifact } from "../artifacts/TestQuery";
				import type { TestQueryNoArgs$result, TestQueryNoArgs$input, TestQueryNoArgs$artifact } from "../artifacts/TestQueryNoArgs";
				import type { MyEnum$options } from "$houdini/graphql/enums";
				import type { NestedUserFilter } from "$houdini/graphql/inputs";
				import type { UserFilter } from "$houdini/graphql/inputs";
				import type { UserInfo$data, UserInfo$artifact } from "../artifacts/UserInfo";
				import type { UserInfoWithArguments$input } from "../artifacts/UserInfoWithArguments";
				import type { UserInfoWithArguments$data, UserInfoWithArguments$artifact } from "../artifacts/UserInfoWithArguments";

				export declare type CacheTypeDef = {
						types: {
							__ROOT__: {
								idFields: {};
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									entities: {
										type: (Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "User"> | null)[] | null;
										args: never;
									};
									entity: {
										type: Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "User">;
										args: never;
									};
									listOfLists: {
										type: ((Record<CacheTypeDef, "User"> | null)[] | null)[];
										args: never;
									};
									node: {
										type: Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "Ghost"> | Record<CacheTypeDef, "User"> | null;
										args: {
											id: string | number;
										};
									};
									nodes: {
										type: (Record<CacheTypeDef, "Cat"> | Record<CacheTypeDef, "Ghost"> | Record<CacheTypeDef, "User">)[];
										args: never;
									};
									user: {
										type: Record<CacheTypeDef, "User"> | null;
										args: {
											enumArg?: MyEnum$options | null | undefined;
											filter?: UserFilter | null | undefined;
											filterList?: (UserFilter)[] | null | undefined;
											id?: string | number | null | undefined;
										};
									};
									users: {
										type: (Record<CacheTypeDef, "User"> | null)[] | null;
										args: {
											admin?: boolean | null | undefined;
											age?: number | null | undefined;
											filter?: UserFilter | null | undefined;
											firstName: string;
											id: string | number;
											list: (UserFilter)[];
											weight?: number | null | undefined;
										};
									};
								};
								fragments: [];
							};
							Animal: {
								idFields: never;
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									isAnimal: {
										type: boolean;
										args: never;
									};
								};
								fragments: [];
							};
							Cat: {
								idFields: {
									id: any;
								};
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									id: {
										type: string;
										args: never;
									};
									isAnimal: {
										type: boolean;
										args: never;
									};
									kitty: {
										type: boolean;
										args: never;
									};
									names: {
										type: (string | null)[];
										args: never;
									};
								};
								fragments: [];
							};
							Ghost: {
								idFields: {
									id: any;
								};
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									aka: {
										type: string;
										args: never;
									};
									id: {
										type: string;
										args: never;
									};
									name: {
										type: string;
										args: never;
									};
								};
								fragments: [];
							};
							Mutation: {
								idFields: never;
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									doThing: {
										type: Record<CacheTypeDef, "User"> | null;
										args: {
											admin?: boolean | null | undefined;
											age?: number | null | undefined;
											filter?: UserFilter | null | undefined;
											firstName: string;
											id: string | number;
											list: (UserFilter)[];
											weight?: number | null | undefined;
										};
									};
								};
								fragments: [];
							};
							Node: {
								idFields: {
									id: any;
								};
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									id: {
										type: string;
										args: never;
									};
								};
								fragments: [];
							};
							User: {
								idFields: {
									id: any;
								};
								fields: {
									__typename: {
										type: string;
										args: never;
									};
									admin: {
										type: boolean | null;
										args: never;
									};
									age: {
										type: number | null;
										args: never;
									};
									enumValue: {
										type: MyEnum$options | null;
										args: never;
									};
									firstName: {
										type: string;
										args: {
											pattern?: string | null | undefined;
										};
									};
									friends: {
										type: (Record<CacheTypeDef, "User"> | null)[] | null;
										args: never;
									};
									id: {
										type: string;
										args: never;
									};
									nickname: {
										type: string | null;
										args: never;
									};
									parent: {
										type: Record<CacheTypeDef, "User"> | null;
										args: never;
									};
									weight: {
										type: number | null;
										args: never;
									};
								};
								fragments: [[UserInfo$artifact, UserInfo$data, never], [UserInfoWithArguments$artifact, UserInfoWithArguments$data, UserInfoWithArguments$input]];
							};
						};
						lists: {
							All_Users: {
								types: "User";
								filters: {
									admin?: boolean | null | undefined;
									age?: number | null | undefined;
									filter?: UserFilter | null | undefined;
									firstName?: string;
									id?: string | number;
									list?: (UserFilter)[];
									weight?: number | null | undefined;
								};
							};
							NoArgs: {
								types: "Cat" | "User";
								filters: never;
							};
						};
						queries: [[TestQuery$artifact, TestQuery$result, TestQuery$input], [TestQueryNoArgs$artifact, TestQueryNoArgs$result, TestQueryNoArgs$input]];
						scalars: number | boolean | string;
				};

				declare module 'houdini/runtime' {
					interface CacheTypeDef {
						scalars: number | boolean | string
					}
				}
			`)

			contents, err := afero.ReadFile(
				plugin.Fs,
				filepath.Join(config.ProjectRoot, config.RuntimeDir, "runtime", "generated.ts"),
			)
			require.NoError(t, err)
			require.Equal(t, expected, strings.TrimSpace(string(contents)))
		},
	})
}

// custom scalar output types have to be registered with the houdini runtime
// (via the CacheTypeDef augmentation) so values like URL or Temporal.Instant
// satisfy the GraphQLObject constraint on every store (issue #1728)
func TestGenerateImperativeCacheTypeDefsCustomScalars(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			scalar URL
			scalar Instant

			type Query {
				user: User
			}

			type User {
				id: ID!
				website: URL
				createdAt: Instant
			}
		`,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			contents, err := afero.ReadFile(
				plugin.Fs,
				filepath.Join(config.ProjectRoot, config.RuntimeDir, "runtime", "generated.ts"),
			)
			require.NoError(t, err)

			for _, expected := range test.Extra["contains"].([]string) {
				require.Contains(t, string(contents), expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "custom scalars are registered with the runtime",
				Pass: true,
				ProjectConfig: func(cfg *plugins.ProjectConfig) {
					cfg.Scalars = map[string]plugins.ScalarConfig{
						"URL": {
							Type: "URL",
						},
						"Instant": {
							Type:   "Temporal.Instant",
							Module: "temporal-polyfill",
						},
					}
				},
				Input: []string{`query UserQuery { user { id website createdAt } }`},
				Extra: map[string]any{
					"contains": []string{
						`import type { Temporal } from 'temporal-polyfill';`,
						`scalars: number | boolean | string | Temporal.Instant | URL;`,
						tests.Dedent(`
							declare module 'houdini/runtime' {
								interface CacheTypeDef {
									scalars: number | boolean | string | Temporal.Instant | URL
								}
							}
						`),
					},
				},
			},
		},
	})
}
