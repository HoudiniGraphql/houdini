import { createSchema, createYoga } from 'graphql-yoga'
import type { RequestEvent } from '@sveltejs/kit'

import { GraphQLError } from 'graphql'

const yogaApp = createYoga<RequestEvent>({
	landingPage: false,
	graphiql: {
		title: "Houdini's GraphiQL"
	},
	schema: createSchema({
		typeDefs: `
			type Query {
				welcome: String!
				links: [Link!]!
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
		`,
		resolvers: {
			Query: {
				welcome: () => 'Welcome to Houdini 🎩',
				links: () => [
					{ name: 'GitHub', url: 'https://github.com/HoudiniGraphql/houdini' },
					{ name: 'Documentation', url: 'https://houdinigraphql.com/' },
					{ name: 'Discord', url: 'https://discord.gg/Gd8vfvxpsD' }
				],
				sponsors: async () => {
					const res = await fetch(
						'https://raw.githubusercontent.com/HoudiniGraphql/sponsors/main/generated/sponsors.json'
					)
					const jsonData = await res.json()

					function getTier(value) {
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

					return jsonData.map((c) => {
						return {
							login: c.sponsor.login,
							name: c.sponsor.name,
							avatarUrl: c.sponsor.avatarUrl,
							websiteUrl: c.sponsor.websiteUrl,
							tiersTitle: getTier(c.monthlyDollars)
						}
					})
				},
				giveMeAnError: () => {
					throw new GraphQLError(`Yes, I'm an error!`)
				}
			},
			Mutation: {
				hello: (_root, args) => {
					return `👋 Hey, hello ${args.name}! `
				}
			}
		}
	}),

	// Needed to let Yoga use sveltekit's Response object
	fetchAPI: globalThis
})

export { yogaApp as GET, yogaApp as POST }
