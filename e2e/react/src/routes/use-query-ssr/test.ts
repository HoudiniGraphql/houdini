import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'

// useQuery's suspense state must be scoped to the request on the server. These requests
// use the raw response body (no hydration runs), so what they see is exactly what the
// server rendered: after the API data changes, a fresh request must render the fresh
// value — a stale value here means the server served one request's resolved query to
// another, which for a session-dependent query is one user's data in another user's HTML.
test('SSR renders each request from its own fetch, not a previous request\'s data', async ({
	request,
}) => {
	// first request warms the server: its HTML carries the current name
	const first = await request.get(routes.use_query_ssr)
	expect(await first.text()).toContain('Bruce Willis')

	// change the data out-of-band (straight to the api, no browser involved)
	const mutation = await request.post('/_api', {
		data: {
			query: `mutation {
				updateUser(id: "1", snapshot: "use-query-ssr", name: "Changed Name") {
					id
					name
				}
			}`,
		},
	})
	expect(mutation.ok()).toBe(true)

	// a second request must fetch for itself and render the new name
	const second = await request.get(routes.use_query_ssr)
	expect(await second.text()).toContain('Changed Name')
})
