import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// a component suspended on useQuery must stay suspended through unrelated parent
// re-renders. the hook seeds its document store before the data arrives, and a
// re-render mid-flight used to see that placeholder as "data" — committing the child
// with an empty object instead of re-throwing the suspense promise.
//
// the route is reached by client-side navigation: on a full load the server streams the
// resolved content (it waits out the query's delay), so the mid-flight window this test
// needs only exists client-side.
test('parent re-render while suspended keeps the fallback until data lands', async ({ page }) => {
	await goto(page, routes.hello)

	// client-side navigate to the route: the child suspends for the 2s server delay
	await page.click('text="use_query_rerender"')
	await expect(page.locator('#fallback')).toBeVisible()

	// re-render the parent while the query is still in flight
	await page.click('button[id=rerender]')

	// the child must still be suspended — not committed with empty data
	await expect(page.locator('#fallback')).toBeVisible()
	await expect(page.locator('#result')).toHaveCount(0)

	// and once the response lands, the real data shows up
	await expect(page.locator('#result')).toHaveText('Bruce Willis', { timeout: 10000 })
})
