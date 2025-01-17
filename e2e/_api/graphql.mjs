import { sleep } from '@kitql/helpers'
import fs from 'fs-extra'
import { GraphQLError } from 'graphql'
import { GraphQLScalarType, Kind } from 'graphql'
import { createPubSub } from 'graphql-yoga'
import path from 'path'

import { connectionFromArray } from './util.mjs'

const pubSub = createPubSub()

export const typeDefs = /* GraphQL */ `
	"""
	Date custom scalar type
	"""
	scalar DateTime
	scalar File

	"""
	Can be Value1 or Value2.
	"""
	enum MyEnum {
		"The first value"
		Value1
		"The second value"
		Value2 @deprecated(reason: "Use Value1 instead")
	}

	enum TypeOfUser {
		NICE
		COOL
	}

	enum ForceReturn {
		"Normal"
		NORMAL
		"No value"
		NULL
		"Some error"
		ERROR
	}

	type Mutation {
		addUser(
			"""
			The users birth date
			"""
			birthDate: DateTime!
			name: String!
			snapshot: String!
			enumValue: MyEnum
			types: [TypeOfUser!]
			delay: Int
			force: ForceReturn
		): User
		addNonNullUser(
			birthDate: DateTime!
			name: String!
			snapshot: String!
			enumValue: MyEnum
			types: [TypeOfUser!]
			delay: Int
			force: ForceReturn
		): User!
		updateUser(
			id: ID!
			name: String
			snapshot: String!
			birthDate: DateTime
			delay: Int
			avatarURL: String
		): User!
		updateUserByID(
			id: ID!
			name: String
			snapshot: String!
			birthDate: DateTime
			delay: Int
			avatarURL: String
		): User!
		singleUpload(file: File!): String!
		multipleUpload(files: [File!]!): [String!]!
		addCity(name: String!): City!
		addLibrary(city: ID!, name: String!): Library!
		addBook(library: ID!, title: String!): Book!
		deleteCity(city: ID!): City!
		deleteLibrary(library: ID!): Library!
		deleteBook(book: ID!, delay: Int, force: ForceReturn): Book
		updateRentedBook(userId: String!, bookId: Int!, rate: Int!): RentedBook
		createA(a: String!): A!
		createB(b: String!): B!
	}

	"""
	A node.
	"""
	interface Node {
		id: ID!
	}

	type PageInfo {
		endCursor: String
		hasNextPage: Boolean!
		hasPreviousPage: Boolean!
		startCursor: String
	}

	input UserNameFilter {
		name: String!
	}

	union UnionAorB = A | B

	type Query {
		book(title: String!): Book
		hello: String
		aOrB: [UnionAorB!]!
		avgYearsBirthDate: Float!
		node(id: ID!): Node
		user(id: ID!, snapshot: String!, tmp: Boolean, delay: Int, forceNullDate: Boolean): User!
		usersConnection(
			after: String
			before: String
			first: Int
			last: Int
			delay: Int
			snapshot: String!
		): UserConnection!
		usersList(limit: Int = 4, offset: Int, snapshot: String!): [User!]!
		userNodes(limit: Int = 4, offset: Int, snapshot: String!): UserNodes!
		userSearch(filter: UserNameFilter!, snapshot: String!): [User!]!
		session: String
		cities: [City]!
		city(id: ID!, delay: Int): City
		userNodesResult(snapshot: String!, forceMessage: Boolean!): UserNodesResult!
		userResult(id: ID!, snapshot: String!, forceMessage: Boolean!): UserResult!
		rentedBooks: [RentedBook!]!
		animals: AnimalConnection!
		monkeys: MonkeyConnection!
		"""
		Get a monkey by its id
		"""
		monkey(id: ID!): Monkey
	}

	type Subscription {
		userUpdate(id: ID!, snapshot: String): User
	}

	type User implements Node {
		birthDate: DateTime
		friendsConnection(after: String, before: String, first: Int, last: Int): UserConnection!
		"This is the same list as what's used globally. its here to tests fragments"
		usersConnection(after: String, before: String, first: Int, last: Int): UserConnection!
		usersConnectionSnapshot(
			after: String
			before: String
			first: Int
			last: Int
			snapshot: String!
		): UserConnection!
		"This is the same list as what's used globally. its here to tests fragments"
		userSearch(filter: UserNameFilter!, snapshot: String!): [User!]!
		friendsList(limit: Int, offset: Int): [User!]!
		id: ID!
		name: String!
		enumValue: MyEnum
		types: [TypeOfUser!]!
		testField(someParam: Boolean!): String
		avatarURL(size: Int): String!
	}

	interface Animal implements Node {
		id: ID!
		name: String!
	}

	"""
	A monkey.
	"""
	type Monkey implements Node & Animal {
		id: ID!
		name: String!
		"""
		Whether the monkey has a banana or not
		"""
		hasBanana: Boolean!
		"""
		Whether the monkey has a banana or not
		"""
		oldHasBanana: Boolean @deprecated(reason: "Use hasBanana")
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

	type UserConnection {
		edges: [UserEdge!]!
		pageInfo: PageInfo!
	}

	type UserEdge {
		cursor: String
		node: User
	}

	type UserNodes {
		totalCount: Int
		nodes: [User!]!
	}

	type Book {
		id: ID!
		title: String!
	}

	type Library {
		id: ID!
		name: String!
		books: [Book]!
	}

	type City {
		id: ID!
		name: String!
		libraries: [Library]!
	}

	type RentedBook {
		userId: String!
		bookId: Int!
		rate: Int!
	}

	type A {
		id: ID!
		a: String!
	}

	type B {
		id: ID!
		b: String!
	}

	union UserNodesResult = UserNodes | Message1
	union UserResult = User | Message1

	type Message1 {
		message: String!
	}
`

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

let monkeys = [
	{ id: '1', name: 'Terk', hasBanana: true, __typename: 'Monkey' },
	{ id: '2', name: 'King Louie', hasBanana: false, __typename: 'Monkey' },
]

// example data
export const dataUsers = [
	{
		id: '1',
		name: 'Bruce Willis',
		birthDate: new Date(1955, 2, 19),
		avatarURL:
			'https://variety.com/wp-content/uploads/2022/03/Bruce-Willis.jpg?w=1000&h=562&crop=1',
	},
	{
		id: '2',
		name: 'Samuel Jackson',
		birthDate: new Date(1948, 11, 21),
		avatarURL: 'https://imaging.broadway.com/images/regular-43/w750/122004-11.jpeg',
	},
	{
		id: '3',
		name: 'Morgan Freeman',
		birthDate: new Date(1937, 5, 0),
		avatarURL:
			'https://www.themoviedb.org/t/p/w600_and_h900_bestv2/jPsLqiYGSofU4s6BjrxnefMfabb.jpg',
	},
	{
		id: '4',
		name: 'Tom Hanks',
		birthDate: new Date(1956, 6, 9),
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Tom_Hanks_TIFF_2019.jpg/440px-Tom_Hanks_TIFF_2019.jpg',
	},
	{
		id: '5',
		name: 'Will Smith',
		birthDate: new Date(1968, 8, 25),
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg/440px-TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg',
	},
	{
		id: '6',
		name: 'Harrison Ford',
		birthDate: new Date(1942, 6, 13),
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Harrison_Ford_by_Gage_Skidmore_3.jpg/1280px-Harrison_Ford_by_Gage_Skidmore_3.jpg',
	},
	{
		id: '7',
		name: 'Eddie Murphy',
		birthDate: new Date(1961, 3, 3),
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Eddie_Murphy_by_David_Shankbone.jpg/440px-Eddie_Murphy_by_David_Shankbone.jpg',
	},
	{
		id: '8',
		name: 'Clint Eastwood',
		birthDate: new Date(1930, 5, 31),
		avatarURL:
			'https://prod-images.tcm.com/Master-Profile-Images/ClintEastwood.55386.jpg?w=824',
	},
]

let dataRentedBooks = [
	{ userId: '1', bookId: 0, rate: 10 },
	{ userId: '5', bookId: 5, rate: 8 },
	{ userId: '1', bookId: 1, rate: 9 },
]

const listA = []
const listB = []

const userSnapshots = {}
export function getUserSnapshot(snapshot) {
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
		aOrB: () => {
			const toRet = []

			toRet.push(
				...listA.map((a) => {
					return { __typename: 'A', ...a }
				})
			)

			toRet.push(
				...listB.map((b) => {
					return { __typename: 'B', ...b }
				})
			)

			return toRet
		},
		book: (_, args) => {
			return dataBooks.find((book) => book.title === args.title)
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
		usersConnection: async (_, args) => {
			// simulate network delay
			if (args.delay) {
				await sleep(args.delay)
			}

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
				throw new Error('User not found', { code: 404 })
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
		async city(_, { id, delay }) {
			if (delay) {
				await sleep(delay)
			}
			return cities.find((c) => c.id.toString() === id)
		},
		monkeys(_, args) {
			return connectionFromArray(monkeys, args)
		},
		monkey(_, { id }) {
			return monkeys.find((m) => m.id.toString() === id)
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
		usersConnectionSnapshot: (user, args) => {
			return connectionFromArray(getUserSnapshot(args.snapshot), args)
		},
		userSearch: (_, args) => {
			const allUsers = [...getUserSnapshot(args.snapshot)]

			return allUsers.filter((user) =>
				user.name.toLowerCase().includes(args.filter.name.toLowerCase())
			)
		},
		enumValue: () => 'Value1',
		testField: (user, args) => {
			if (args.someParam) {
				return 'Hello world'
			}

			return null
		},
		avatarURL: (user, { size }) => {
			return !size ? user.avatarURL : user.avatarURL + `?size=${size}`
		},
	},

	Mutation: {
		addNonNullUser(...args) {
			return this.addUser(...args)
		},
		addUser: async (_, args) => {
			if (args.delay) {
				await sleep(args.delay)
			}

			if (args.force === 'NULL') {
				// we don't want to handle a GraphQL error here. Just a null return
				return null
			}

			if (args.force === 'ERROR') {
				throw new GraphQLError('force ERROR!', { code: 501 })
			}

			const list = getUserSnapshot(args.snapshot)

			const user = {
				id: `${args.snapshot}:${list.length + 1}`,
				name: args.name,
				birthDate: args.birthDate,
				enumValue: args.enumValue,
				types: args.types ?? [],
				avatarURL: '',
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
			if (args.avatarURL) {
				list[userIndex].avatarURL = args.avatarURL
			}

			pubSub.publish('userUpdate', args.id + ':' + args.snapshot, list[userIndex])

			return list[userIndex]
		},
		updateUserByID: async (_, args) => {
			if (args.delay) {
				await sleep(args.delay)
			}

			const list = getUserSnapshot(args.snapshot)
			const userIndex = list.findIndex((c) => c.id === args.id)
			if (userIndex === -1) {
				throw new GraphQLError('User not found', { code: 404 })
			}
			if (args.birthDate) {
				list[userIndex].birthDate = args.birthDate
			}
			if (args.name) {
				list[userIndex].name = args.name
			}
			if (args.avatarURL) {
				list[userIndex].avatarURL = args.avatarURL
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
		deleteBook: async (_, args) => {
			if (args.delay) {
				await sleep(args.delay)
			}

			if (args.force === 'NULL') {
				// we don't want to handle a GraphQL error here. Just a null return
				return null
			}

			if (args.force === 'ERROR') {
				throw new GraphQLError('force ERROR!', { code: 501 })
			}

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
		createA: (_, args) => {
			const a = { id: listA.length + 1, a: args.a }
			listA.push(a)
			return a
		},
		createB: (_, args) => {
			const b = { id: listB.length + 1, b: args.b }
			listB.push(b)
			return b
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
