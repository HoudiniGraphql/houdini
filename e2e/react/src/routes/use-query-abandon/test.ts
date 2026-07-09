import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { expect_1_gql, expect_n_gql } from '~/utils/testsHelper.js'

// Suspending, navigating away before the fetch lands, and coming back must reuse the
// resolved suspense entry: the data shows without a second fetch, and the store that the
// abandoned fetch created still carries cache updates. (The nav must be client-side —
// a full page load would reset the module state this flow exercises.)
test('abandoning a suspended useQuery and returning reuses the resolved fetch', async ({
	page,
}) => {
	await page.goto(routes.hello)

	// client-side navigate to the slow query: it suspends
	await page.click('text="use_query_abandon"')
	await expect(page.locator('#fallback')).toHaveText('loading')

	// abandon it mid-flight
	await page.click('text="hello"')
	await expect(page.locator('#result')).toHaveText('Hello World! // From Houdini!')

	// let the abandoned fetch resolve while we're away
	await page.waitForTimeout(2500)

	// returning must not fire a second fetch: the resolved entry is picked back up
	await expect_n_gql(page, 'text="use_query_abandon"', 0)
	await expect(page.locator('#name')).toHaveText('Bruce Willis')

	// and the store the abandoned fetch created still carries cache updates
	await expect_1_gql(page, 'button[id=update]')
	await expect(page.locator('#name')).toHaveText('Updated Name')
})
