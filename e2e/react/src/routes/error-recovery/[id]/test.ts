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

	// error boundaries don't run during SSR, so a direct load of an erroring param relies
	// on the on_render retry: the first pass rejects, the failure is seeded into the
	// boundary, and the second pass streams +error.tsx with a 500 (instead of a raw stack
	// trace). The client then hydrates into the same error state and stays interactive.
	test('SSR: a direct load of an errored param renders the error view', async ({ page }) => {
		// plain page.goto (not the helper): the hydrated client refetches the failing
		// query once to rebuild the error state, so the zero-request accounting the
		// helper enforces doesn't apply here
		const response = await page.goto(routes.error_recovery + '/999', {
			waitUntil: 'domcontentloaded',
		})
		expect(response?.status()).toBe(500)
		await expect(page.locator('#error-message')).toHaveText('User not found')

		// the hydrated app recovers by navigating to the healthy param
		await page.click('#to-good')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
	})
})
