const { gql } = require('apollo-server')
const { data: books } = require('./data')

module.exports.schema = gql`
	type Book {
		title: String
		author: String
	}

	type Query {
		books: [Book]
	}
`

module.exports.resolvers = {
	Query: {
		books: () => books,
	},
}
