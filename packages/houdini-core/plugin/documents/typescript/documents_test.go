package typescript_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins/tests"
)

func TestTypescriptGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
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
						  import type artifact from './TestQuery'

							export type TestQuery = {
									readonly "input": TestQuery$input;
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
											 * @deprecated Use firstName instead
											*/
											readonly firstname: string;
											readonly " $fragments": {
													otherInfo: {};
											};
									} | null;
							};

							export type TestQuery$input = null;

							export type TestQuery$artifact = typeof artifact
					`),
					"otherInfo": tests.Dedent(`
							import { MyEnum } from "$houdini/graphql/enums";
							import type { ValueOf } from "$houdini/runtime/lib/types";
							export type otherInfo$input = {};

							import type artifact from './otherInfo'

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
									readonly enumValue: ValueOf<typeof MyEnum> | null;
									readonly age: number | null;
									/**
									 * The user's first name
									 * @deprecated Use firstName instead
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
						import type artifact from './TestFragment'
						import { MyEnum } from "$houdini/graphql/enums";
						import type { ValueOf } from "$houdini/runtime/lib/types";

						export type TestFragment$input = {};

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
							readonly firstName: string;
							readonly nickname: string | null;
							readonly enumValue: ValueOf<typeof MyEnum> | null;
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
						import type artifact from './TestFragment'

						export type TestFragment$input = {
							name?: string | null | undefined;
						};

						export type TestFragment = {
							readonly "shape"?: TestFragment$data;
							readonly " $fragments": {
								"TestFragment": any;
							};
						};

						export type TestFragment$data = {
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
						import type artifact from './TestFragment'

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
							import type artifact from './TestFragment'

							export type TestFragment$input = {};

							export type TestFragment = {
								readonly "shape"?: TestFragment$data;
								readonly " $fragments": {
									"TestFragment": any;
								};
							};

							export type TestFragment$data = {
								readonly firstName: string;
								readonly parent: {
									readonly firstName: string;
								} | null;
							};

							export type TestFragment$artifact = typeof artifact
						`),
				},
			},
			{
				Name: "scalars",
				Input: []string{
					`fragment TestFragment on User { firstName admin age id weight }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
							import type artifact from './TestFragment'

							export type TestFragment$input = {};

							export type TestFragment = {
								readonly "shape"?: TestFragment$data;
								readonly " $fragments": {
									"TestFragment": any;
								};
							};

							export type TestFragment$data = {
								readonly firstName: string;
								readonly admin: boolean | null;
								readonly age: number | null;
								readonly id: string;
								readonly weight: number | null;
							};

							export type TestFragment$artifact = typeof artifact
						`),
				},
			},
			{
				Name: "list types",
				Input: []string{
					`fragment TestFragment on User { firstName friends { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"TestFragment": tests.Dedent(`
							import type artifact from './TestFragment'

							export type TestFragment$input = {};

							export type TestFragment = {
								readonly "shape"?: TestFragment$data;
								readonly " $fragments": {
									"TestFragment": any;
								};
							};

							export type TestFragment$data = {
								readonly firstName: string;
								readonly friends: ({
									readonly firstName: string;
								} | null)[] | null;
							};

							export type TestFragment$artifact = typeof artifact
						`),
				},
			},
			{
				Name: "query with no input",
				Input: []string{
					`query MyQuery { user { firstName } }`,
				},
				Pass: true,
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
							import type artifact from './MyQuery'

							export type MyQuery = {
								readonly "input": MyQuery$input;
								readonly "result": MyQuery$result | undefined;
							};

							export type MyQuery$result = {
								readonly user: {
									readonly firstName: string;
								} | null;
							};

							export type MyQuery$input = null;

							export type MyQuery$artifact = typeof artifact
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
						import type artifact from './MyQuery'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly users: ({
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
							import type artifact from './MyQuery'
							import type { ValueOf } from "$houdini/runtime/lib/types";
							import type { MyEnum } from "$houdini/graphql/enums";

							export type MyQuery = {
								readonly "input": MyQuery$input;
								readonly "result": MyQuery$result | undefined;
							};

							export type MyQuery$result = {
								readonly user: {
									readonly firstName: string;
								} | null;
							};

							export type MyQuery$input = {
								id: string;
								enum?: ValueOf<typeof MyEnum> | null | undefined;
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
						import type artifact from './MyTestQuery'

						export type MyTestQuery = {
							readonly "input": MyTestQuery$input;
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

						export type MyTestQuery$input = null;

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
						import type artifact from './MyQuery'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly user: {
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
						import type artifact from './MyQuery'

						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly nodes: ({} & (({
								readonly id: string;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly __typename: "Cat";
							}) | ({
								readonly __typename: "non-exhaustive; don't match this";
							})))[];
						};

						export type MyQuery$input = null;

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
						import type artifact from './MyQuery'

						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly __typename: "Cat";
							})) | null)[] | null;
						};

						export type MyQuery$input = null;

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
						import type artifact from './ComplexQuery'

						export type ComplexQuery = {
							readonly "input": ComplexQuery$input;
							readonly "result": ComplexQuery$result | undefined;
						};

						export type ComplexQuery$result = {
							readonly nodes: ({} & (({
								readonly id: string;
								readonly firstName: string;
								readonly admin: boolean | null | undefined;
								readonly age: number | null | undefined;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly kitty: boolean;
								readonly names: (string | null | undefined)[];
								readonly __typename: "Cat";
							})))[];
						};

						export type ComplexQuery$input = null;

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
						import type artifact from './UnionQuery'

						export type UnionQuery = {
							readonly "input": UnionQuery$input;
							readonly "result": UnionQuery$result | undefined;
						};

						export type UnionQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly firstName: string;
								readonly admin: boolean | null | undefined;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly kitty: boolean;
								readonly isAnimal: boolean;
								readonly __typename: "Cat";
							})))[] | null;
						};

						export type UnionQuery$input = null;

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
						import type artifact from './MixedQuery'

						export type MixedQuery = {
							readonly "input": MixedQuery$input;
							readonly "result": MixedQuery$result | undefined;
						};

						export type MixedQuery$result = {
							readonly nodes: ({} & (({
								readonly id: string;
								readonly firstName: string;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly kitty: boolean;
								readonly __typename: "Cat";
							})))[];
						};

						export type MixedQuery$input = null;

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
						import type artifact from './AbstractConcreteQuery'

						export type AbstractConcreteQuery = {
							readonly "input": AbstractConcreteQuery$input;
							readonly "result": AbstractConcreteQuery$result | undefined;
						};

						export type AbstractConcreteQuery$result = {
							readonly entities: ({} & (({
								readonly id: string;
								readonly firstName: string;
								readonly admin: boolean | null | undefined;
								readonly __typename: "User";
							}) | ({
								readonly id: string;
								readonly kitty: boolean;
								readonly isAnimal: boolean;
								readonly __typename: "Cat";
							})))[] | null;
						};

						export type AbstractConcreteQuery$input = null;

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
						import type artifact from './UnionAbstractQuery'

						export type UnionAbstractQuery = {
							readonly "input": UnionAbstractQuery$input;
							readonly "result": UnionAbstractQuery$result | undefined;
						};

						export type UnionAbstractQuery$result = {
							readonly entities: ({} & (({
								readonly firstName: string;
								readonly admin: boolean | null | undefined;
								readonly age: number | null | undefined;
								readonly __typename: "User";
							}) | ({
								readonly kitty: boolean;
								readonly isAnimal: boolean;
								readonly names: (string | null | undefined)[];
								readonly __typename: "Cat";
							})))[] | null;
						};

						export type UnionAbstractQuery$input = null;

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
						import type artifact from './AnimalCatQuery'

						export type AnimalCatQuery = {
							readonly "input": AnimalCatQuery$input;
							readonly "result": AnimalCatQuery$result | undefined;
						};

						export type AnimalCatQuery$result = {
							readonly entities: ({} & (({
								readonly __typename: "User";
							}) | ({
								readonly isAnimal: boolean;
								readonly kitty: boolean;
								readonly __typename: "Cat";
							})))[] | null;
						};

						export type AnimalCatQuery$input = null;

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
						import type artifact from './MyMutation'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type MyMutation = {
							readonly "input": MyMutation$input;
							readonly "result": MyMutation$result;
						};

						export type MyMutation$result = {
							readonly doThing: {
								readonly firstName: string;
							} | null;
						};

						export type MyMutation$input = {
							filter?: UserFilter | null | undefined;
							filterList: (UserFilter)[];
							id: string;
							firstName: string;
							admin?: boolean | null | undefined;
							age?: number | null | undefined;
							weight?: number | null | undefined;
						};

						export type MyMutation$optimistic = {
							readonly doThing?: {
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
						import type artifact from './MyQuery'

						export type MyQuery = {
							readonly "input": MyQuery$input;
							readonly "result": MyQuery$result | undefined;
						};

						export type MyQuery$result = {
							readonly user: {
								readonly " $fragments": {
									Foo: {};
								};
							} | null;
						};

						export type MyQuery$input = null;

						export type MyQuery$artifact = typeof artifact
					`),
					"Foo": tests.Dedent(`
						import type artifact from './Foo'

						export type Foo$input = {};

						export type Foo = {
							readonly "shape"?: Foo$data;
							readonly " $fragments": {
								"Foo": any;
							};
						};

						export type Foo$data = {
							readonly firstName: string;
						};

						export type Foo$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "@loading on fragment - happy path",
				Input: []string{
					`fragment UserBase on User {
						id
						firstName @loading
						parent @loading {
							id @loading
							parent @loading {
								id
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserBase": tests.Dedent(`
						import type artifact from './UserBase'
						import { LoadingType } from "$houdini/runtime/lib/types";

						export type UserBase$input = {};

						export type UserBase = {
							readonly "shape"?: UserBase$data;
							readonly " $fragments": {
								"UserBase": any;
							};
						};

						export type UserBase$data = {
							readonly id: string;
							readonly firstName: string;
							readonly parent: {
								readonly id: string;
								readonly parent: {
									readonly id: string;
								} | null;
							} | null;
						} | {
							readonly firstName: LoadingType;
							readonly parent: {
								readonly id: LoadingType;
								readonly parent: LoadingType;
							};
						};

						export type UserBase$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "@loading on query - happy path",
				Input: []string{
					`query UserQuery {
						user @loading {
							firstName @loading
							parent @loading {
								id @loading
								parent @loading {
									id
								}
							}
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserQuery": tests.Dedent(`
						import type artifact from './UserQuery'
						import { LoadingType } from "$houdini/runtime/lib/types";

						export type UserQuery = {
							readonly "input": UserQuery$input;
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							readonly user: {
								readonly firstName: string;
								readonly parent: {
									readonly id: string;
									readonly parent: {
										readonly id: string;
									} | null;
								} | null;
							} | null;
						} | {
							readonly user: {
								readonly firstName: LoadingType;
								readonly parent: {
									readonly id: LoadingType;
									readonly parent: LoadingType;
								};
							};
						};

						export type UserQuery$input = null;

						export type UserQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "@loading on list",
				Input: []string{
					`query UserQuery($list: [UserFilter!]!) {
						users(list: $list, id: "1", firstName: "test") @loading {
							id
						}
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserQuery": tests.Dedent(`
						import type artifact from './UserQuery'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import { LoadingType } from "$houdini/runtime/lib/types";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type UserQuery = {
							readonly "input": UserQuery$input;
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							readonly users: ({
								readonly id: string;
							})[];
						} | {
							readonly users: LoadingType[];
						};

						export type UserQuery$input = {
							list: (UserFilter)[];
						};

						export type UserQuery$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "generated types include fragment loading state",
				Input: []string{
					`query UserQuery($list: [UserFilter!]!) {
						users(list: $list, id: "1", firstName: "test") @loading {
							...UserBase @loading
						}
					}`,
					`fragment UserBase on User {
						firstName
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserQuery": tests.Dedent(`
						import type artifact from './UserQuery'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import { LoadingType } from "$houdini/runtime/lib/types";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type UserQuery = {
							readonly "input": UserQuery$input;
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							readonly users: ({
								readonly " $fragments": {
									UserBase: {};
								};
							})[];
						} | {
							readonly users: {
								readonly " $fragments": {
									UserBase: {};
								};
							}[];
						};

						export type UserQuery$input = {
							list: (UserFilter)[];
						};

						export type UserQuery$artifact = typeof artifact
					`),
					"UserBase": tests.Dedent(`
						import type artifact from './UserBase'

						export type UserBase$input = {};

						export type UserBase = {
							readonly "shape"?: UserBase$data;
							readonly " $fragments": {
								"UserBase": any;
							};
						};

						export type UserBase$data = {
							readonly firstName: string;
						};

						export type UserBase$artifact = typeof artifact
					`),
				},
			},
			{
				Name: "global @loading on fragment",
				Input: []string{
					`query UserQuery($list: [UserFilter!]!) @loading {
						users(list: $list, id: "1", firstName: "test") {
							...UserBase
						}
					}`,
					`fragment UserBase on User {
						firstName
					}`,
				},
				Pass: true,
				Extra: map[string]any{
					"UserQuery": tests.Dedent(`
						import type artifact from './UserQuery'
						import type { ValueOf } from "$houdini/runtime/lib/types";
						import type { MyEnum } from "$houdini/graphql/enums";
						import { LoadingType } from "$houdini/runtime/lib/types";
						import type { UserFilter } from "$houdini/graphql/inputs";

						export type UserQuery = {
							readonly "input": UserQuery$input;
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							readonly users: ({
								readonly " $fragments": {
									UserBase: {};
								};
							})[];
						} | {
							readonly users: {
								readonly firstName: LoadingType;
								readonly id: LoadingType;
								readonly __typename: LoadingType;
								readonly " $fragments": {
									UserBase: {};
								};
							}[];
						};

						export type UserQuery$input = {
							list: (UserFilter)[];
						};

						export type UserQuery$artifact = typeof artifact
					`),
					"UserBase": tests.Dedent(`
						import type artifact from './UserBase'

						export type UserBase$input = {};

						export type UserBase = {
							readonly "shape"?: UserBase$data;
							readonly " $fragments": {
								"UserBase": any;
							};
						};

						export type UserBase$data = {
							readonly firstName: string;
						};

						export type UserBase$artifact = typeof artifact
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
						import type artifact from './UserQuery'

						export type UserQuery = {
							readonly "result": UserQuery$result | undefined;
						};

						export type UserQuery$result = {
							readonly user: {
								readonly __typename: string;
								readonly firstName: string;
							} | null;
						};

						export type UserQuery$artifact = typeof artifact
					`),
				},
			},
		},
	})
}
