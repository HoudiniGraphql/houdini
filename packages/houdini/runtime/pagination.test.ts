import { extractPageInfo } from './utils'

test('can extract current page info', function () {
	const data = {
		user: {
			friends: {
				pageInfo: {
					startCursor: '1',
					endCursor: '2',
					hasNextPage: true,
					hasPreviousPage: false,
				},
				edges: [
					{
						node: {
							id: '1',
						},
					},
				],
			},
		},
	}

	const path = ['user', 'friends']

	expect(extractPageInfo(data, path)).toEqual(data.user.friends.pageInfo)
})
