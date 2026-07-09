import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { expect_1_gql, goto } from '~/utils/testsHelper.js'

// useQuery fetches a query imperatively from inside a component and suspends until the
// data lands. These tests pin the API: the initial load is served by the server (the
// query resolves during SSR and hydration reads the streamed cache snapshot, so no
// client request fires), and changing the variables re-runs the query with the new
// result.
test.describe('useQuery', () => {
	test('renders data fetched from inside a component', async ({ page }) => {
		// the query resolved during SSR; hydration serves it from the cache
		await goto(page, routes.use_query)

		await expect(page.locator('#result')).toHaveText('Bruce Willis, Samuel Jackson')
	})

	test('re-runs when the variables change', async ({ page }) => {
		await goto(page, routes.use_query)

		await expect(page.locator('#result')).toHaveText('Bruce Willis, Samuel Jackson')

		// bumping the limit variable re-issues the query and renders the larger result
		await expect_1_gql(page, 'button[id=more]')

		await expect(page.locator('#result')).toHaveText(
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks'
		)
	})
})
