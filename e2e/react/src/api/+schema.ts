import { makeExecutableSchema } from '@graphql-tools/schema'

const typeDefs = /* GraphQL */ `
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
		avatarUrl(size: Int): String!
		websiteUrl: String
		tiersTitle: String!
	}
`

const resolvers = {
	Query: {
		welcome: () => 'Welcome to Houdini 🎩',
		links: async (_: any, args: { delay?: number }) => {
			if (args.delay) {
				await new Promise((resolve) => setTimeout(resolve, args.delay))
			}
			return [
				{ name: 'GitHub', url: 'https://github.com/HoudiniGraphql/houdini' },
				{ name: 'Documentation', url: 'https://houdinigraphql.com/' },
				{ name: 'Discord', url: 'https://discord.gg/Gd8vfvxpsD' },
			]
		},
		sponsors: async () => {
			const res = await fetch(
				'https://raw.githubusercontent.com/HoudiniGraphql/sponsors/main/generated/sponsors.json'
			)
			const jsonData = await res.json()

			function getTier(value: number) {
				if (value >= 1500) {
					return 'Wizard'
				}
				if (value >= 500) {
					return 'Mage'
				}
				if (value >= 25) {
					return "Magician's Apprentice"
				}
				if (value >= 10) {
					return 'Supportive Muggle'
				}
				return 'Past Sponsors'
			}

			return jsonData.map(
				(c: {
					sponsor: {
						login: string
						name: string
						avatarUrl: string
						websiteUrl: string
					}
					monthlyDollars: number
				}) => {
					return {
						login: c.sponsor.login,
						name: c.sponsor.name,
						avatarUrl: c.sponsor.avatarUrl,
						websiteUrl: c.sponsor.websiteUrl,
						tiersTitle: getTier(c.monthlyDollars),
					}
				}
			)
		},
		giveMeAnError: () => {
			throw new Error(`Yes, I'm an error!`)
		},
	},
	Sponsor: {
		avatarUrl: (root: { avatarUrl: string }, args: { size?: number }) => {
			return `${root.avatarUrl}${args.size ? `&size=${args.size}` : ''}`
		},
	},
	Mutation: {
		hello: (_: any, args: { name: string }) => {
			return `👋 Hey, hello ${args.name}! `
		},
	},
}

export default makeExecutableSchema({ typeDefs, resolvers })
