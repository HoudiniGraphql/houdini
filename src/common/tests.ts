import path from 'path'
import { ConfigFile } from '../runtime'
import { Config, LogLevel } from '../common'

export function testConfigFile(config: Partial<ConfigFile> = {}): ConfigFile {
	return {
		sourceGlob: '123',
		schema: `
			scalar Cursor


			type User implements Node {
				id: ID!
				firstName: String!
				friends: [User!]!
				friendsByCursor(first: Int, after: String, last: Int, before: String, filter: String): UserConnection!
				friendsByCursorScalar(first: Int, after: Cursor, last: Int, before: Cursor, filter: String): UserConnection!
				friendsByBackwardsCursor(last: Int, before: String, filter: String): UserConnectionScalar!
				friendsByForwardsCursor(first: Int, after: String, filter: String): UserConnection!
				friendsByOffset(offset: Int, limit: Int, filter: String): [User!]!
				friendsInterface: [Friend!]!
				believesIn: [Ghost!]!
				believesInConnection(first: Int, after: String, filter: String): GhostConnection!
				cats: [Cat!]!
				field(filter: String): String
			}

			type Ghost implements Friend {
				name: String!
				aka: String!
				believers: [User!]!
				friends: [Ghost!]!
				friendsConnection(first: Int, after: String): GhostConnection!
				legends: [Legend!]!
			}

			type Legend {
				name: String
				believers(first: Int, after: String): GhostConnection
			}

			type Cat implements Friend & Node {
				id: ID!
				name: String!
				owner: User!
			}

			type Query {
				user: User!
				version: Int!
				ghost: Ghost!
				ghosts: GhostConnection!
				friends: [Friend!]!
				users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
				entities: [Entity!]!
				usersByCursor(first: Int, after: String, last: Int, before: String): UserConnection!
				usersByBackwardsCursor(last: Int, before: String): UserConnection!
				usersByForwardsCursor(first: Int, after: String): UserConnection!
				usersByOffset(offset: Int, limit: Int): [User!]!
				node(id: ID!): Node
			}

			type PageInfo {
				hasPreviousPage: Boolean!
				hasNextPage: Boolean!
				startCursor: String!
				endCursor: String!
			}

			type UserEdge {
				cursor: String!
				node: User
			}

			type UserEdgeScalar {
				cursor: Cursor!
				node: User
			}

			type UserConnection {
				pageInfo: PageInfo!
				edges: [UserEdge!]!
			}

			type UserConnectionScalar {
				pageInfo: PageInfo!
				edges: [UserEdgeScalar!]!
			}

			type GhostEdge {
				cursor: String!
				node: Ghost
			}

			type GhostConnection {
				pageInfo: PageInfo!
				edges: [GhostEdge!]!
			}

			interface Friend {
				name: String!
			}

			union Entity = User | Cat | Ghost

			type Mutation {
				updateUser: User!
				addFriend: AddFriendOutput!
				believeIn: BelieveInOutput!
				deleteUser(id: ID!): DeleteUserOutput!
				catMutation: CatMutationOutput!
				deleteCat: DeleteCatOutput!
			}

			type Subscription {
				newUser: NewUserResult!
			}

			type NewUserResult {
				user: User!
			}

			type AddFriendOutput {
				friend: User!
			}

			type BelieveInOutput {
				ghost: Ghost
			}

			type DeleteUserOutput {
				userID: ID!
			}

			type DeleteCatOutput {
				catID: ID
			}

			type CatMutationOutput {
				cat: Cat
			}

			interface  Node {
				id: ID!
			}

			enum TestEnum1 {
				Value1
				Value2
			}

			enum TestEnum2 {
				Value3
				Value2
			}
		`,
		framework: 'kit',
		types: {
			Ghost: {
				keys: ['name', 'aka'],
				resolve: {
					queryField: 'ghost',
				},
			},
		},
		logLevel: LogLevel.Quiet,
		...config,
	}
}

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		...testConfigFile(config),
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
