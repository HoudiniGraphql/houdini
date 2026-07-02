import { test, expect } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The loading frame injects a real $handle for a paginated @loading query: reading
// handle.pageInfo during the frame (extractPageInfo over loading-marker data) must not
// crash, and once the data lands the same page's resolved handle must paginate.
test.describe('paginated delayed loading state', () => {
	test('the loading frame carries a paginated handle and pagination works after', async ({
		page,
	}) => {
		await goto(page, routes.delayed_loading_pagination + '?delay=0')
		await expect(page.locator('#result')).toHaveText('Bruce Willis, Samuel Jackson')

		await page.click('#to-slow')

		// the frame renders: loading rows from the marker data, and the render-time
		// pageInfo read survives the loading-state values
		await expect(page.locator('#result')).toHaveText(/loading/)
		await expect(page.locator('#page-info')).toBeAttached()

		// the data lands and the resolved handle paginates
		await expect(page.locator('#result')).toHaveText('Bruce Willis, Samuel Jackson')
		await page.click('#next')
		await expect(page.locator('#result')).toHaveText(
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks'
		)
	})
})
