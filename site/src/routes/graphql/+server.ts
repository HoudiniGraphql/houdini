import type { RequestEvent } from '@sveltejs/kit'
import { createSchema, createYoga } from 'graphql-yoga'

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
			links(delai: Int): [Link!]!
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
		`,
		resolvers: {
			Query: {
				welcome: () => 'Welcome to Houdini 🎩',
				links: async (_, args) => {
					if (args.delai) {
						await new Promise((resolve) => setTimeout(resolve, args.delai))
					}
					return [
						{ name: 'GitHub', url: 'https://github.com/HoudiniGraphql/houdini' },
						{ name: 'Documentation', url: 'https://houdinigraphql.com/' },
						{ name: 'Discord', url: 'https://discord.gg/Gd8vfvxpsD' }
					]
				},
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
			Sponsor: {
				avatarUrl: (root: { avatarUrl: string }, args: { size?: number }) => {
					return `${root.avatarUrl}${args.size ? `&size=${args.size}` : ''}`
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

export { yogaApp as GET, yogaApp as OPTIONS, yogaApp as POST }
