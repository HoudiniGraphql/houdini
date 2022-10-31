import { GraphQLYogaError } from '@graphql-yoga/node'
import { sleep } from '@kitql/helper'
import fs from 'fs-extra'
import { GraphQLScalarType, Kind } from 'graphql'
import { connectionFromArray } from 'graphql-relay'
import path from 'path'

const sourceFiles = ['../_api/schema.graphql', '../_api/schema-hello.graphql']
export const typeDefs = sourceFiles.map((filepath) =>
	fs.readFileSync(path.resolve(filepath), 'utf-8')
)

// example data
const data = [
	{ id: '1', name: 'Bruce Willis', birthDate: new Date(1955, 2, 19) },
	{ id: '2', name: 'Samuel Jackson', birthDate: new Date(1948, 11, 21) },
	{ id: '3', name: 'Morgan Freeman', birthDate: new Date(1937, 5, 0) },
	{ id: '4', name: 'Tom Hanks', birthDate: new Date(1956, 6, 9) },
	{ id: '5', name: 'Will Smith', birthDate: new Date(1968, 8, 25) },
	{ id: '6', name: 'Harrison Ford', birthDate: new Date(1942, 6, 13) },
	{ id: '7', name: 'Eddie Murphy', birthDate: new Date(1961, 3, 3) },
	{ id: '8', name: 'Clint Eastwood', birthDate: new Date(1930, 5, 31) },
]
const snapshots = {}

function getSnapshot(snapshot) {
	if (!snapshots[snapshot]) {
		snapshots[snapshot] = data.map((user) => ({
			...user,
			id: `${snapshot}:${user.id}`,
			snapshot,
		}))
	}

	return snapshots[snapshot]
}

async function processFile(file) {
	const fileStream = file.stream()
	const filename = path.join('./', file.name)
	await fs.promises.writeFile(filename, fileStream)
	return await fs.promises.readFile(filename, 'utf8').then(async (data) => {
		await fs.promises.unlink(filename)
		return data
	})
}

export const resolvers = {
	Query: {
		hello: () => {
			return 'Hello World! // From Houdini!'
		},
		usersList: (_, args) => {
			return [...getSnapshot(args.snapshot)].splice(args.offset || 0, args.limit)
		},
		session: (_, args, info) => {
			let token = null
			info.request.headers.forEach((value, key) => {
				if (key === 'authorization') {
					token = value.replace('Bearer ', '')
				}
			})
			if (token) {
				return token
			}
			throw new GraphQLYogaError('No authorization found', { code: 403 })
		},
		usersConnection(_, args) {
			return connectionFromArray(getSnapshot(args.snapshot), args)
		},
		user: async (_, args) => {
			// simulate network delay
			if (args.delay) {
				await sleep(args.delay)
			}

			const user = getSnapshot(args.snapshot).find(
				(c) => c.id === `${args.snapshot}:${args.id}`
			)

			if (args.forceNullDate) {
				user.birthDate = null
			}

			if (!user) {
				throw new GraphQLYogaError('User not found', { code: 404 })
			}
			return user
		},
		avgYearsBirthDate: () => {
			return list.map((c) => c.birthDate.getFullYear()).reduce((a, b) => a + b) / list.length
		},
		node(_, { id: nodeID }) {
			const [snapshot, id] = nodeID.split(':')
			const list = getSnapshot(snapshot)
			const user = list.find((u) => u.id === nodeID)

			return {
				...user,
				__typename: 'User',
			}
		},
	},

	User: {
		friendsList: (user, args) => {
			return [...getSnapshot(user.snapshot)].splice(args.offset || 0, args.limit)
		},
		friendsConnection(user, args) {
			return connectionFromArray(getSnapshot(user.snapshot), args)
		},
	},

	Mutation: {
		addUser: async (_, args) => {
			const list = getSnapshot(args.snapshot)
			if (args.delay) {
				await sleep(args.delay)
			}
			const user = {
				id: (list.length + 1).toString(),
				name: args.name,
				birthDate: args.birthDate,
				enumValue: args.enumValue,
				types: args.types ?? [],
			}
			list.push(user)
			return user
		},
		updateUser: async (_, args) => {
			if (args.delay) {
				await sleep(args.delay)
			}

			const list = getSnapshot(args.snapshot)
			const userIndex = list.findIndex((c) => c.id === `${args.snapshot}:${args.id}`)
			if (userIndex === -1) {
				throw new GraphQLYogaError('User not found', { code: 404 })
			}
			if (args.birthDate) {
				list[userIndex].birthDate = args.birthDate
			}
			if (args.name) {
				list[userIndex].name = args.name
			}
			return list[userIndex]
		},
		singleUpload: async (_, { file }) => {
			try {
				let data = await processFile(file)
				return data
			} catch (e) {}
			throw new GraphQLYogaError('ERROR', { code: 500 })
		},
		multipleUpload: async (_, { files }) => {
			let res = []
			for (let i in files) {
				try {
					let data = await processFile(files[i])
					res.push(data)
				} catch (e) {
					throw new GraphQLYogaError('ERROR', { code: 500 })
				}
			}
			return res
		},
	},

	DateTime: new GraphQLScalarType({
		name: 'DateTime',
		description: 'Date custom scalar type',
		serialize(value) {
			return value.getTime()
		},
		parseValue(value) {
			return new Date(value)
		},
		parseLiteral(ast) {
			if (ast.kind === Kind.INT) {
				return new Date(parseInt(ast.value, 10))
			}
			return null
		},
	}),
}
