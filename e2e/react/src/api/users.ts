import { sleep } from '~/utils/sleep'

import { builder } from './builder'

export type User = {
	id: string
	name: string
	avatarURL: string
}

builder.simpleObject('User', {
	fields: (t) => ({
		id: t.id(),
		name: t.string(),
		avatarURL: t.string({
			args: {
				size: t.arg.int({
					required: false,
				}),
			},
		}),
	}),
})

// example data
const users: User[] = [
	{
		id: '1',
		name: 'Bruce Willis',
		avatarURL:
			'https://variety.com/wp-content/uploads/2022/03/Bruce-Willis.jpg?w=1000&h=562&crop=1',
	},
	{
		id: '2',
		name: 'Samuel Jackson',
		avatarURL: 'https://imaging.broadway.com/images/regular-43/w750/122004-11.jpeg',
	},
	{
		id: '3',
		name: 'Morgan Freeman',
		avatarURL:
			'https://www.themoviedb.org/t/p/w600_and_h900_bestv2/jPsLqiYGSofU4s6BjrxnefMfabb.jpg',
	},
	{
		id: '4',
		name: 'Tom Hanks',
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Tom_Hanks_TIFF_2019.jpg/440px-Tom_Hanks_TIFF_2019.jpg',
	},
	{
		id: '5',
		name: 'Will Smith',
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg/440px-TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg',
	},
	{
		id: '6',
		name: 'Harrison Ford',
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Harrison_Ford_by_Gage_Skidmore_3.jpg/1280px-Harrison_Ford_by_Gage_Skidmore_3.jpg',
	},
	{
		id: '7',
		name: 'Eddie Murphy',
		avatarURL:
			'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Eddie_Murphy_by_David_Shankbone.jpg/440px-Eddie_Murphy_by_David_Shankbone.jpg',
	},
	{
		id: '8',
		name: 'Clint Eastwood',
		avatarURL:
			'https://prod-images.tcm.com/Master-Profile-Images/ClintEastwood.55386.jpg?w=824',
	},
]

builder.queryField('user', (t) =>
	t.field({
		type: 'User',
		args: {
			id: t.arg({
				type: 'ID',
				required: true,
			}),
			delay: t.arg({
				type: 'Int',
			}),
			snapshot: t.arg({
				type: 'String',
				required: true,
			}),
		},
		resolve: async (_, args) => {
			// simulate network delay
			if (args.delay) {
				await sleep(args.delay)
			}

			// look for the user
			const user = getUserSnapshot(args.snapshot).find(
				(c) => c.id === `${args.snapshot}:${args.id}`
			)
			if (!user) {
				throw new Error('User not found')
			}
			return user
		},
	})
)

builder.queryField('users', (t) =>
	t.field({
		type: ['User'],
		args: {
			delay: t.arg.int(),
			snapshot: t.arg.string({ required: true }),
		},
		resolve: async (_, args) => {
			// simulate network delay
			if (args.delay) {
				await sleep(args.delay)
			}

			// look for the user
			return getUserSnapshot(args.snapshot)
		},
	})
)

const userSnapshots: Record<string, User[]> = {}

function getUserSnapshot(snapshot: string) {
	if (!userSnapshots[snapshot]) {
		userSnapshots[snapshot] = users.map((user) => ({
			...user,
			id: `${snapshot}:${user.id}`,
			snapshot,
		}))
	}

	return userSnapshots[snapshot]
}
