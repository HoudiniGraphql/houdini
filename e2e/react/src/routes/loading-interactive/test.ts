import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, goto } from '~/utils/testsHelper.js'

test.describe('@loading page hydration', () => {
	// issue #1408: a page whose query is marked @loading streams its loading frame and then
	// has the resolved markup swapped in by the server stream. The client must still hydrate
	// the page so it is interactive. A button that increments a counter is the minimal proof:
	// if hydration never commits, clicking it does nothing.
	test('the page is interactive after the loading state resolves', async ({ page }) => {
		await goto(page, routes.loading_interactive)

		// the real data lands once the @loading query resolves
		await expect_to_be(page, 'Bruce Willis', '#name')

		// clicking the button must update the counter, which only happens if React hydrated
		await page.click('button[id=increment]')
		await expect_to_be(page, '1', '#count')

		await page.click('button[id=increment]')
		await expect_to_be(page, '2', '#count')
	})
})
