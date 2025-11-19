package typescript_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/spf13/afero"
)

func TestTypescriptGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
        """ Documentation of MyEnum """
				enum MyEnum {
								"""Documentation of Hello"""
					Hello
				}

				type Query {
					"""Get a user."""
					user(
						id: ID, 
						filter: UserFilter, 
						filterList: [UserFilter!], 
						enumArg: MyEnum
					): User
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

				"""A user in the system"""
				type User implements Node {
					id: ID!

					"""The user's first name"""
					firstName(pattern: String): String!
					"""The user's first name"""
					firstname: String! @deprecated(reason: "Use firstName instead")
					nickname: String
					parent: User
					friends: [User]
					"""An enum value"""
					enumValue: MyEnum

					admin: Boolean
					age: Int
					weight: Float
				}
    `,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			// for every document that we want to generate types for
			for docName, expected := range test.Extra {
				// open the file with the appropriate type definitions
				typeDefs, err := afero.ReadFile(plugin.Fs, config.ArtifactTypePath(docName))

				// make sure values match expectations
				require.NoError(t, err)
				require.Contains(t, string(typeDefs), expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "generates document types",
				Input: []string{
					`
						query TestQuery {
								user(id: "123") {
										firstName, admin, ...otherInfo, firstname
								}
						}
					`,
					`
						fragment otherInfo on User {
								enumValue
								age
								firstname
						}
					`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
						export type TestQuery = {
							readonly "input"?: TestQuery$input;
							readonly "result": TestQuery$result | undefined;
						};

						export type TestQuery$result = {
							/**
							 * Get a user.
							 */
							readonly user: {
								/**
								 * The user's first name
								 */
								readonly firstName: string;
								readonly admin: boolean | null;
								/**
								 * The user's first name
								 */
								readonly firstname: string;
								readonly " $fragments": {
									otherInfo: {};
								};
							} | null;
						};

						export type TestQuery$input = null | undefined;

						export type TestQuery$artifact = typeof artifact
					`),
					"otherInfo": tests.Dedent(`
						export type otherInfo$input = never;

						export type otherInfo = {
							readonly "shape"?: otherInfo$data;
							readonly " $fragments": {
								"otherInfo": any;
							};
						};

						export type otherInfo$data = {
							/**
							 * An enum value
							 */
							readonly enumValue: MyEnum$options | null;
							readonly age: number | null;
							/**
							 * The user's first name
							 */
							readonly firstname: string;
						};

						export type otherInfo$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "fragment types",
				Input: []string{
					`fragment TestFragment on User { firstName nickname enumValue }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
						export type TestFragment$input = never;

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
							/**
							 * The user's first name
							 */
							readonly firstName: string;
							readonly nickname: string | null;
							/**
							 * An enum value
							 */
							readonly enumValue: MyEnum$options | null;
						};

						export type TestFragment$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "fragment types with variables",
				Input: []string{
					`fragment TestFragment on Query @arguments(name:{ type: "ID" }) { user(id: $name) { age } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
						export type TestFragment$input = {
							name?: string | null;
						};

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
							/**
							 * Get a user.
							 */
							readonly user: {
								readonly age: number | null;
							} | null;
						};

						export type TestFragment$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "fragment types with required variables",
				Input: []string{
					`fragment TestFragment on Query @arguments(name:{ type: "ID!" }) { user(id: $name) { age } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
						export type TestFragment$input = {
							name: string;
						};

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
							/**
							 * Get a user.
							 */
							readonly user: {
								readonly age: number | null;
							} | null;
						};

						export type TestFragment$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "nested types",
				Input: []string{
					`fragment TestFragment on User { firstName parent { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
						export type TestFragment$input = never;

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
							/**
							 * The user's first name
							 */
							readonly firstName: string;
							readonly parent: {
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null;
						};

						export type TestFragment$artifact = typeof artifact
					`),
				},
			},

			{
				Name: "query with root list",
				Input: []string{
					`query MyQuery($list: [UserFilter!]!) { users(list: $list, id: "1", firstName: "test") { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly users: ({
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null)[] | null;
						};

						export type MyQuery$input = {
							list: (UserFilter)[];
						};

						export type MyQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "query with input",
				Input: []string{
					`query MyQuery($id: ID!, $enum: MyEnum) { user(id: $id, enumArg: $enum ) { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							/**
							 * Get a user.
							 */
							readonly user: {
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null;
						};

						export type MyQuery$input = {
							id: string;
							enum?: MyEnum$options | null;
						};

						export type MyQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "interface on interface",
				Input: []string{
					`query MyTestQuery { entity { ... on Node { id } } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyTestQuery": tests.Dedent(`
						export type MyTestQuery = {
							readonly "input"?: MyTestQuery$input;
							readonly "result": MyTestQuery$result | undefined;
						};

						export type MyTestQuery$result = {
							readonly entity: {} & (({
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly __typename: "User";
							}));
						};

						export type MyTestQuery$input = null | undefined;

						export type MyTestQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "nested input objects",
				Input: []string{
					`query MyQuery($filter: UserFilter!) { user(filter: $filter) { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							/**
							 * Get a user.
							 */
							readonly user: {
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null;
						};

						export type MyQuery$input = {
							filter: UserFilter;
						};

						export type MyQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "interfaces",
				Input: []string{
					`query MyQuery { nodes { ... on User { id } ... on Cat { id } } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input"?: MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly nodes: ({} & (({
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly __typename: "User";
							}) | ({
								readonly __typename: "non-exhaustive; don't match this";
							})))[];
						};

						export type MyQuery$input = null | undefined;

						export type MyQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "unions",
				Input: []string{
					`query MyQuery { entities { ... on User { id } ... on Cat { id } } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input"?: MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly __typename: "User";
							})) | null)[] | null;
						};

						export type MyQuery$input = null | undefined;

						export type MyQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "complex interface with multiple fields",
				Input: []string{
					`query ComplexQuery {
						nodes {
							id
							... on User {
								firstName
								admin
								age
							}
							... on Cat {
								kitty
								names
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"ComplexQuery": tests.Dedent(`
						export type ComplexQuery = {
							readonly "input"?: ComplexQuery$input;
							readonly "result": ComplexQuery$result | undefined;
						};

						export type ComplexQuery$result = {
							readonly nodes: ({} & (({
								readonly kitty: boolean;
								readonly names: (string | null)[];
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly firstName: string;
								readonly admin: boolean | null;
								readonly age: number | null;
								readonly id: string;
								readonly __typename: "User";
							}) | ({
								readonly __typename: "non-exhaustive; don't match this";
							})))[];
						};

						export type ComplexQuery$input = null | undefined;

						export type ComplexQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "union with shared and specific fields",
				Input: []string{
					`query UnionQuery {
						entities {
							... on User {
								id
								firstName
								admin
							}
							... on Cat {
								id
								kitty
								isAnimal
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UnionQuery": tests.Dedent(`
						export type UnionQuery = {
							readonly "input"?: UnionQuery$input;
							readonly "result": UnionQuery$result | undefined;
						};

						export type UnionQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly kitty: boolean;
								readonly isAnimal: boolean;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly firstName: string;
								readonly admin: boolean | null;
								readonly __typename: "User";
							})) | null)[] | null;
						};

						export type UnionQuery$input = null | undefined;

						export type UnionQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "interface with shared fields and type-specific fields",
				Input: []string{
					`query MixedQuery {
						nodes {
							id
							... on User {
								id
								firstName
							}
							... on Cat {
								id
								kitty
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"MixedQuery": tests.Dedent(`
						export type MixedQuery = {
							readonly "input"?: MixedQuery$input;
							readonly "result": MixedQuery$result | undefined;
						};

						export type MixedQuery$result = {
							readonly nodes: ({} & (({
								readonly id: string;
								readonly kitty: boolean;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly firstName: string;
								readonly __typename: "User";
							}) | ({
								readonly __typename: "non-exhaustive; don't match this";
							})))[];
						};

						export type MixedQuery$input = null | undefined;

						export type MixedQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "abstract and concrete inline fragments merged",
				Input: []string{
					`query AbstractConcreteQuery {
						entities {
							... on Node {
								id
							}
							... on User {
								firstName
								admin
							}
							... on Cat {
								kitty
								isAnimal
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"AbstractConcreteQuery": tests.Dedent(`
						export type AbstractConcreteQuery = {
							readonly "input"?: AbstractConcreteQuery$input;
							readonly "result": AbstractConcreteQuery$result | undefined;
						};

						export type AbstractConcreteQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly kitty: boolean;
								readonly isAnimal: boolean;
								readonly __typename: "Cat";
							}) | ({
								readonly id: string;
								readonly firstName: string;
								readonly admin: boolean | null;
								readonly __typename: "User";
							})) | null)[] | null;
						};

						export type AbstractConcreteQuery$input = null | undefined;

						export type AbstractConcreteQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "union with abstract and concrete fragments",
				Input: []string{
					`query UnionAbstractQuery {
						entities {
							... on Entity {
								... on User {
									firstName
								}
								... on Cat {
									kitty
								}
							}
							... on User {
								admin
								age
							}
							... on Cat {
								isAnimal
								names
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UnionAbstractQuery": tests.Dedent(`
						export type UnionAbstractQuery = {
							readonly "input"?: UnionAbstractQuery$input;
							readonly "result": UnionAbstractQuery$result | undefined;
						};

						export type UnionAbstractQuery$result = {
							readonly entities: ({} & (({
								readonly kitty: boolean;
								readonly id: string;
								readonly isAnimal: boolean;
								readonly names: (string | null)[];
								readonly __typename: "Cat";
							}) | ({
								readonly firstName: string;
								readonly id: string;
								readonly admin: boolean | null;
								readonly age: number | null;
								readonly __typename: "User";
							})) | null)[] | null;
						};

						export type UnionAbstractQuery$input = null | undefined;

						export type UnionAbstractQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "interface fragment with concrete type fragment",
				Input: []string{
					`query AnimalCatQuery {
						entities {
							... on Animal {
								isAnimal
							}
							... on Cat {
								kitty
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"AnimalCatQuery": tests.Dedent(`
						export type AnimalCatQuery = {
							readonly "input"?: AnimalCatQuery$input;
							readonly "result": AnimalCatQuery$result | undefined;
						};

						export type AnimalCatQuery$result = {
							readonly entities: ({} & (({
								readonly isAnimal: boolean;
								readonly kitty: boolean;
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly __typename: "non-exhaustive; don't match this";
							})) | null)[] | null;
						};

						export type AnimalCatQuery$input = null | undefined;

						export type AnimalCatQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "mutation with input list",
				Input: []string{
					`mutation MyMutation(
						$filter: UserFilter,
						$filterList: [UserFilter!]!,
						$id: ID!
						$firstName: String!
						$admin: Boolean
						$age: Int
						$weight: Float
					) { doThing(
						filter: $filter,
						list: $filterList,
						id:$id
						firstName:$firstName
						admin:$admin
						age:$age
						weight:$weight
					) {
						firstName
					  }
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyMutation": tests.Dedent(`
						export type MyMutation = {
							readonly "input": MyMutation$input;
							readonly "result": MyMutation$result;
						};

						export type MyMutation$result = {
							readonly doThing: {
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null;
						};

						export type MyMutation$input = {
							filter?: UserFilter | null;
							filterList: (UserFilter)[];
							id: string;
							firstName: string;
							admin?: boolean | null;
							age?: number | null;
							weight?: number | null;
						};

						export type MyMutation$optimistic = {
							readonly doThing?: {
								/**
								 * The user's first name
								 */
								readonly firstName?: string;
							} | null;
						};

						export type MyMutation$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "fragment spreads",
				Input: []string{
					`fragment Foo on User { firstName }`,
					`query MyQuery { user { ...Foo } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
						export type MyQuery = {
							readonly "input"?: MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							/**
							 * Get a user.
							 */
							readonly user: {
								readonly " $fragments": {
									Foo: {};
								};
							} | null;
						};

						export type MyQuery$input = null | undefined;

						export type MyQuery$artifact = typeof artifact
					`),
					"Foo": tests.Dedent(`
						export type Foo$input = never;

						export type Foo = {
							readonly "shape"?: Foo$data;
							readonly " $fragments": {
								"Foo": any;
							};
						};

						export type Foo$data = {
							/**
							 * The user's first name
							 */
							readonly firstName: string;
						};

						export type Foo$artifact = typeof artifact
					`),
				},
			},

			{
				Name: "explicit __typename field",
				Input: []string{
					`
						query UserQuery {
							user(id: "123") {
								__typename
								firstName
							}
						}
					`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserQuery": tests.Dedent(`
						export type UserQuery = {
							readonly "input"?: UserQuery$input;
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							/**
							 * Get a user.
							 */
							readonly user: {
								readonly __typename: string;
								/**
								 * The user's first name
								 */
								readonly firstName: string;
							} | null;
						};

						export type UserQuery$input = null | undefined;

						export type UserQuery$artifact = typeof artifact
					`),
				},
			},
		},
	})
}
