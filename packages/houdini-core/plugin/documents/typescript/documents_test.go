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
								enumValue, age, firstname
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

							export type TestQuery$artifact = artifact
					`),
				},
			},
		},
	})
}
