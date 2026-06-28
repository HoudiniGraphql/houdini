import { test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { expect_to_be, goto } from '~/utils/testsHelper.js'

test.describe('@loading query that errors', () => {
	// A query marked @loading streams its loading frame before the query resolves, so an error
	// from the API has to be carried to the client; otherwise the page hangs on the loading
	// state instead of reaching +error.tsx. We cover both entry points into the route.

	// the initial SSR load: the shell flushes with the loading frame, then the API errors and
	// the error must stream down so the client surfaces it on the boundary after hydration.
	test('SSR: an erroring @loading query reaches the error boundary', async ({ page }) => {
		await goto(page, routes.loading_error)
		await expect_to_be(page, 'User not found', '#error-message')
	})

	// a client-side navigation into the route: the query is sent from the browser and its error
	// must unblock the @loading suspense and throw to the boundary.
	test('client-side nav: an erroring @loading query reaches the error boundary', async ({
		page,
	}) => {
		await goto(page, routes.loading_error_link)
		await page.click('#to-loading-error')
		await expect_to_be(page, 'User not found', '#error-message')
	})
})
