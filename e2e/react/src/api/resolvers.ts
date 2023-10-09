import { dico } from './dico'

export const resolvers = {
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
	Mutation: {
		hello: (_: any, args: { name: string }) => {
			return `${dico.HELLO} ${args.name}!`
		},
	},
}
