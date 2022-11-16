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

// Example Cities/Libraries/Books data
// Assume a traditional relational database for storage - each table with unique ID.
let cityId = 1
let libraryId = 1
let bookId = 1

// Allow the "database" to be persistent and mutable
let cities = [
	{
		id: cityId++,
		name: 'Alexandria',
		libraries: [
			{
				id: libraryId++,
				name: 'The Library of Alexandria',
				books: [
					{ id: bookId++, title: 'Callimachus Pinakes' },
					{ id: bookId++, title: 'Kutubkhana-i-lskandriyya' },
				],
			},
			{
				id: libraryId++,
				name: 'Bibliotheca Alexandrina',
				books: [{ id: bookId++, title: 'Analyze your own personality' }],
			},
		],
	},
	{
		id: cityId++,
		name: 'Istanbul',
		libraries: [
			{
				id: libraryId++,
				name: 'The Imperial Library of Constantinople',
				books: [
					{ id: bookId++, title: 'Homer' },
					{ id: bookId++, title: 'The Hellenistic History' },
				],
			},
		],
	},
]

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
		userNodes: (_, args) => {
			const allData = [...getSnapshot(args.snapshot)]
			return {
				totalCount: allData.length,
				nodes: allData.splice(args.offset || 0, args.limit),
			}
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
		cities: () => {
			return cities
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
				id: `${args.snapshot}:${list.length + 1}`,
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
		addCity: (_, args) => {
			const city = {
				id: cityId++,
				name: args.name,
				libraries: [],
			}

			cities.push(city)
			return city
		},
		addLibrary: (_, args) => {
			const cityId = Number.parseInt(args.city)
			const city = cities.find((city) => city.id === cityId)
			if (!city) {
				throw new GraphQLYogaError('City not found', { code: 404 })
			}

			const library = {
				id: libraryId++,
				name: args.name,
				books: [],
			}
			city.libraries.push(library)
			return library
		},
		addBook: (_, args) => {
			const libraryId = Number.parseInt(args.library)
			const city = cities.find((city) =>
				city.libraries.find((library) => library.id === libraryId)
			)
			if (!city) {
				throw new GraphQLYogaError('City/Library not found', { code: 404 })
			}
			const library = city.libraries.find((library) => library.id === libraryId)

			const book = {
				id: bookId++,
				title: args.title,
			}
			library.books.push(book)
			return book
		},
		deleteCity: (_, args) => {
			const cityId = Number.parseInt(args.city)
			const city = cities.find((city) => city.id === cityId)
			cities = cities.filter((city) => city.id !== cityId)
			return city
		},
		deleteLibrary: (_, args) => {
			const libraryId = Number.parseInt(args.library)
			const city = cities.find((city) =>
				city.libraries.find((library) => library.id === libraryId)
			)
			if (!city) {
				throw new GraphQLYogaError('City/Library not found', { code: 404 })
			}
			const library = city.libraries.find((library) => library.id === libraryId)
			city.libraries = city.libraries.filter((library) => library.id !== libraryId)
			return library
		},
		deleteBook: (_, args) => {
			const bookId = Number.parseInt(args.book)
			const city = cities.find((city) =>
				city.libraries.find((library) => library.books.find((book) => book.id === bookId))
			)
			if (!city) {
				throw new GraphQLYogaError('City/Library/Book not found', { code: 404 })
			}
			const library = city.libraries.find((library) =>
				library.books.find((book) => book.id === bookId)
			)
			const book = library.books.find((book) => book.id === bookId)
			library.books = library.books.filter((book) => book.id !== bookId)
			return book
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
