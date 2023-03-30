import { sleep } from '@kitql/helper'
import fs from 'fs-extra'
import { GraphQLError } from 'graphql'
import { GraphQLScalarType, Kind } from 'graphql'
import { createPubSub } from 'graphql-yoga'
import path from 'path'
import url from 'url'

import { connectionFromArray } from './util.mjs'

const pubSub = createPubSub()

const sourceFiles = ['schema.graphql', 'schema-hello.graphql']
export const typeDefs = sourceFiles.map((filepath) => {
	const filepathToUse = path.join(path.dirname(url.fileURLToPath(import.meta.url)), filepath)
	return fs.readFileSync(path.resolve(filepathToUse), 'utf-8')
})

// Example Cities/Libraries/Books data
// Assume a traditional relational database for storage - each table with unique ID.
let cityId = 1
let libraryId = 1
let bookId = 1

const dataBooks = [
	{ id: bookId++, title: 'Callimachus Pinakes' },
	{ id: bookId++, title: 'Kutubkhana-i-lskandriyya' },
	{ id: bookId++, title: 'Analyze your own personality' },
	{ id: bookId++, title: 'Homer' },
	{ id: bookId++, title: 'The Hellenistic History' },
]

// Allow the "database" to be persistent and mutable
let cities = [
	{
		id: cityId++,
		name: 'Alexandria',
		libraries: [
			{
				id: libraryId++,
				name: 'The Library of Alexandria',
				books: [dataBooks[0], dataBooks[1]],
			},
			{
				id: libraryId++,
				name: 'Bibliotheca Alexandrina',
				books: [dataBooks[2]],
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
				books: [dataBooks[3], dataBooks[4]],
			},
		],
	},
]

// example data
const dataUsers = [
	{ id: '1', name: 'Bruce Willis', birthDate: new Date(1955, 2, 19) },
	{ id: '2', name: 'Samuel Jackson', birthDate: new Date(1948, 11, 21) },
	{ id: '3', name: 'Morgan Freeman', birthDate: new Date(1937, 5, 0) },
	{ id: '4', name: 'Tom Hanks', birthDate: new Date(1956, 6, 9) },
	{ id: '5', name: 'Will Smith', birthDate: new Date(1968, 8, 25) },
	{ id: '6', name: 'Harrison Ford', birthDate: new Date(1942, 6, 13) },
	{ id: '7', name: 'Eddie Murphy', birthDate: new Date(1961, 3, 3) },
	{ id: '8', name: 'Clint Eastwood', birthDate: new Date(1930, 5, 31) },
]

let dataRentedBooks = [
	{ userId: '1', bookId: 0, rate: 10 },
	{ userId: '5', bookId: 5, rate: 8 },
	{ userId: '1', bookId: 1, rate: 9 },
]

const userSnapshots = {}
function getUserSnapshot(snapshot) {
	if (!userSnapshots[snapshot]) {
		userSnapshots[snapshot] = dataUsers.map((user) => ({
			...user,
			id: `${snapshot}:${user.id}`,
			snapshot,
		}))
	}

	return userSnapshots[snapshot]
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
			return [...getUserSnapshot(args.snapshot)].splice(args.offset || 0, args.limit)
		},
		userNodes: (_, args) => {
			const allData = [...getUserSnapshot(args.snapshot)]
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
			throw new GraphQLError('No authorization found', { code: 403 })
		},
		usersConnection(_, args) {
			return connectionFromArray(getUserSnapshot(args.snapshot), args)
		},
		user: async (_, args) => {
			// simulate network delay
			if (args.delay) {
				await sleep(args.delay)
			}

			const user = getUserSnapshot(args.snapshot).find(
				(c) => c.id === `${args.snapshot}:${args.id}`
			)

			if (args.forceNullDate) {
				user.birthDate = null
			}

			if (!user) {
				throw new GraphQLError('User not found', { code: 404 })
			}
			return user
		},
		avgYearsBirthDate: () => {
			return list.map((c) => c.birthDate.getFullYear()).reduce((a, b) => a + b) / list.length
		},
		node(_, { id: nodeID }) {
			const [snapshot, id] = nodeID.split(':')
			const list = getUserSnapshot(snapshot)
			const user = list.find((u) => u.id === nodeID)

			return {
				...user,
				__typename: 'User',
			}
		},
		cities: () => {
			return cities
		},
		userNodesResult: async (_, args) => {
			if (args.forceMessage) {
				return {
					message: `snapshot:${args.snapshot}`,
					__typename: 'Message1',
				}
			}

			const allData = [...getUserSnapshot(args.snapshot)]
			return {
				totalCount: allData.length,
				nodes: allData.splice(args.offset || 0, args.limit || 10),
				__typename: 'UserNodes',
			}
		},
		userResult: async (_, args) => {
			if (args.forceMessage) {
				return {
					message: `snapshot:${args.snapshot}`,
					__typename: 'Message1',
				}
			}

			const user = getUserSnapshot(args.snapshot).find(
				(c) => c.id === `${args.snapshot}:${args.id}`
			)
			return { ...user, __typename: 'User' }
		},
		userSearch: async (_, args) => {
			const allUsers = [...getUserSnapshot(args.snapshot)]

			return allUsers.filter((user) =>
				user.name.toLowerCase().includes(args.filter.name.toLowerCase())
			)
		},
		rentedBooks: async (_, args) => {
			return dataRentedBooks
		},
		city(_, { id }) {
			return cities.find((c) => c.id.toString() === id)
		},
		monkeys(_, args) {
			return connectionFromArray(
				[
					{ id: '1', name: 'Terk', hasBanana: true, __typename: 'Monkey' },
					{ id: '2', name: 'King Louie', hasBanana: false, __typename: 'Monkey' },
				],
				args
			)
		},
	},
	Subscription: {
		userUpdate: {
			// subscribe to the randomNumber event
			subscribe: (_, { id, snapshot }) => pubSub.subscribe('userUpdate', id + ':' + snapshot),
			resolve: (payload) => payload,
		},
	},
	User: {
		friendsList: (user, args) => {
			return [...getUserSnapshot(user.snapshot)].splice(args.offset || 0, args.limit)
		},
		friendsConnection(user, args) {
			return connectionFromArray(getUserSnapshot(user.snapshot), args)
		},
		usersConnection: (user, args) => {
			return connectionFromArray(getUserSnapshot(user.snapshot), args)
		},
		userSearch: (_, args) => {
			const allUsers = [...getUserSnapshot(args.snapshot)]

			return allUsers.filter((user) =>
				user.name.toLowerCase().includes(args.filter.name.toLowerCase())
			)
		},
		enumValue: () => 'Value1',
	},

	Mutation: {
		addUser: async (_, args) => {
			const list = getUserSnapshot(args.snapshot)
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

			const list = getUserSnapshot(args.snapshot)
			const userIndex = list.findIndex((c) => c.id === `${args.snapshot}:${args.id}`)
			if (userIndex === -1) {
				throw new GraphQLError('User not found', { code: 404 })
			}
			if (args.birthDate) {
				list[userIndex].birthDate = args.birthDate
			}
			if (args.name) {
				list[userIndex].name = args.name
			}

			pubSub.publish('userUpdate', args.id + ':' + args.snapshot, list[userIndex])

			return list[userIndex]
		},
		singleUpload: async (_, { file }) => {
			try {
				let data = await processFile(file)
				return data
			} catch (e) {}
			throw new GraphQLError('ERROR', { code: 500 })
		},
		multipleUpload: async (_, { files }) => {
			let res = []
			for (let i in files) {
				try {
					let data = await processFile(files[i])
					res.push(data)
				} catch (e) {
					throw new GraphQLError('ERROR', { code: 500 })
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
				throw new GraphQLError('City not found', { code: 404 })
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
				throw new GraphQLError('City/Library not found', { code: 404 })
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
				throw new GraphQLError('City/Library not found', { code: 404 })
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
				throw new GraphQLError('City/Library/Book not found', { code: 404 })
			}
			const library = city.libraries.find((library) =>
				library.books.find((book) => book.id === bookId)
			)
			const book = library.books.find((book) => book.id === bookId)
			library.books = library.books.filter((book) => book.id !== bookId)
			return book
		},
		updateRentedBook: (_, args) => {
			const { userId, bookId, rate } = args

			const found = dataRentedBooks.filter((c) => c.bookId === bookId && c.userId === userId)

			if (found && found.length > 0) {
				const updated = {
					userId,
					bookId,
					rate,
				}
				dataRentedBooks = [
					...dataRentedBooks.filter((c) => !(c.bookId === bookId && c.userId === userId)),
					updated,
				]

				return updated
			}

			throw new GraphQLError('RentedBook not found', { code: 403 })
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
