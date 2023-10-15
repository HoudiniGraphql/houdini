export const typeDefs = /* GraphQL */ `
	type Query {
		welcome: String!
		links(delay: Int): [Link!]!
		sponsors: [Sponsor!]!
		giveMeAnError: String
	}

	type Mutation {
		hello(name: String!): String!
	}

	type Link {
		name: String
		url: String
	}

	type Sponsor {
		login: String!
		name: String!
		avatarUrl: String!
		websiteUrl: String
		tiersTitle: String!
	}
`
