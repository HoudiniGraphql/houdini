import * as graphql from 'graphql'
import { vol } from 'memfs'

import type { ConfigFile } from '../../src/runtime/lib/config'
import { ArtifactKind, type ArtifactKinds } from '../../src/runtime/lib/types'
import { runPipeline } from '../codegen'
import type { Document } from '../lib'
import { Config, fs, path } from '../lib'

export function clearMock() {
	// Clear the mock filesystem volume
	vol.reset()
}

export function testConfig(config: Partial<ConfigFile> = {}): Config {
	return new Config({ configFile: testConfigFile(config) })
}

export function testConfigFile({ plugins, ...config }: Partial<ConfigFile> = {}): ConfigFile {
	return {
		schema: `
			scalar Cursor
			scalar DateTime

			directive @live on QUERY

			input MyInput {
				string: String
			}

			type User implements Node & Friend & CatOwner {
				id: ID!
				name(arg: Int): String!
				birthday: DateTime!
				firstName: String! @deprecated(reason: "Use name instead")
				friends: [User!]!
				friendsByCursor(first: Int, after: String, last: Int, before: String, filter: String): UserConnection!
				friendsByCursorSnapshot(snapshot: String!, first: Int, after: String, last: Int, before: String): UserConnection!
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

			type Ghost implements Friend & CatOwner & IsGhost {
				name: String!
				aka: String!
				believers: [User!]!
				friends: [Ghost!]!
				friendsConnection(first: Int, after: String): GhostConnection!
				legends: [Legend!]!
				cats: [Cat!]!
			}

			type Legend {
				name: String
				believers(first: Int, after: String): GhostConnection
			}

			"""
			Cat's documentation
			"""
			type Cat implements Friend & Node {
				id: ID!
				"""
				The name of the cat
				"""
				name: String!
				owner: User!
			}

			type Query {
				"""
				Get a user.
				"""
				user: User!
				entity: Entity!
				version: Int!
				ghost: Ghost!
				ghosts: GhostConnection!
				friends: [Friend!]!
				users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
				entities: [Entity!]!
				catOwners: [CatOwner!]!
				usersByCursor(first: Int, after: String, last: Int, before: String): UserConnection!
				usersByBackwardsCursor(last: Int, before: String): UserConnection!
				usersByForwardsCursor(first: Int, after: String): UserConnection!
				usersByOffset(offset: Int, limit: Int, stringFilter: String, filter: UserFilter): [User!]!
				friendsByCursor(first: Int, after: String, last: Int, before: String): FriendConnection!
				ghostsByCursor(first: Int, after: String, last: Int, before: String): IsGhostConnection!
				entitiesByCursor(first: Int, after: String, last: Int, before: String): EntityConnection!
				node(id: ID!): Node
				customIdList: [CustomIdType]!
				nodes(ids: [ID!]!): [Node!]!
    			monkeys: MonkeyConnection!
				animals(first: Int, after: String): AnimalConnection

			}

			input UserFilter {
				name: String
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

			type UserConnection {
				pageInfo: PageInfo!
				edges: [UserEdge!]!
			}

			type FriendEdge {
				cursor: String!
				node: Friend
			}

			type FriendConnection {
				pageInfo: PageInfo!
				edges: [FriendEdge!]!
			}

			type UserEdgeScalar {
				cursor: Cursor!
				node: User
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

			type EntityEdge {
				cursor: String!
				node: Entity
			}

			type EntityConnection {
				pageInfo: PageInfo!
				edges: [EntityEdge!]!
			}

			type IsGhostEdge {
				cursor: String!
				node: IsGhost
			}

			type IsGhostConnection {
				pageInfo: PageInfo!
				edges: [IsGhostEdge!]!
			}

			interface Friend {
				name: String!
			}

			interface CatOwner {
				cats: [Cat!]!
			}

			interface IsGhost {
				aka: String!
			}

			interface Animal implements Node {
				id: ID!
				name: String!
			}

			type Monkey implements Node & Animal {
				id: ID!
				name: String!
				hasBanana: Boolean!
			}

			interface AnimalConnection {
				edges: [AnimalEdge!]!
				pageInfo: PageInfo!
			}

			interface AnimalEdge {
				cursor: String
				node: Animal
			}

			type MonkeyConnection implements AnimalConnection {
				edges: [MonkeyEdge!]!
				pageInfo: PageInfo!
			}

			type MonkeyEdge implements AnimalEdge {
				cursor: String
				node: Monkey
			}

			union Entity = User | Cat | Ghost

			type Mutation {
				updateUser: User!
				updateGhost: Ghost!
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

			"""
			Documentation of testenum1
			"""
			enum TestEnum1 {
				"Documentation of Value1"
				Value1
				"Documentation of Value2"
				Value2
			}

			"""
			Documentation of testenum2
			"""
			enum TestEnum2 {
				Value3
				Value2
			}

			type CustomIdType {
				foo: String!
				bar: String!
				dummy: String
			}
		`,
		module: 'esm',

		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					if (typeof val !== 'number') {
						throw new Error('unmarshaling not a number')
					}
					return new Date(val)
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
		types: {
			Ghost: {
				keys: ['name', 'aka'],
				resolve: {
					queryField: 'ghost',
				},
			},
			CustomIdType: {
				keys: ['foo', 'bar'],
			},
		},
		logLevel: 'quiet',
		plugins: {
			'houdini-svelte': {
				client: './my/client/path',
			},
			...plugins,
		},
		features: {
			componentFields: true,
			imperativeCache: true,
			runtimeScalars: {
				ViewerIDFromSession: {
					type: 'ID',
					resolve: ({ session }: { session?: App.Session | null | undefined }) =>
						(session as unknown as any).token,
				},
			},
		},
		...config,
	}
}
