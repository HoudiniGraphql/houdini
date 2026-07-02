import { test, expect } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// Route boundaries persist across same-route navigations (they aren't remounted per URL),
// so the error boundary clears a caught error itself when the URL changes. Navigating from
// a param that errors to one that succeeds must render the page again instead of sticking
// on +error.tsx — and navigating back into the failing param must error again.
test.describe('error boundary recovery', () => {
	test('same-route nav away from an errored param recovers', async ({ page }) => {
		await goto(page, routes.error_recovery + '/1')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')

		// navigate into the failing param: the boundary catches the API error
		await page.click('#to-bad')
		await expect(page.locator('#error-message')).toHaveText('User not found')

		// navigate to the healthy param: the boundary resets and the page renders
		await page.click('#to-good')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')

		// and back into the failing param: the boundary catches again
		await page.click('#to-bad')
		await expect(page.locator('#error-message')).toHaveText('User not found')
	})
})
