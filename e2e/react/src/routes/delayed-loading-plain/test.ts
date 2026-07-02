import { test, expect } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A route with no @loading state never shows a loading frame: a slow navigation keeps the
// previous page on screen for the whole transition and swaps once the data is ready. This
// pins the delayed-loading feature's degradation path — the loading swap only applies to
// entries that have a frame, so a plain route must neither error nor hang when a
// navigation outlives loadingDelay. The URL only updates when the navigation commits, so
// waiting on it doubles as waiting for the data.
test.describe('delayed loading without @loading', () => {
	test('client nav: a slow navigation holds the previous page', async ({ page }) => {
		await goto(page, routes.delayed_loading_plain + '?delay=0')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')

		await page.click('#to-slow')

		// well past loadingDelay (100ms in config), the previous page is still the only
		// thing on screen — no frame, no error boundary, no blank — and useNavigation
		// reports the held navigation so the app can render its own indicator
		await page.waitForTimeout(400)
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
		await expect(page.locator('#name')).toHaveCount(1)
		await expect(page.locator('#nav-status')).toHaveText(
			'navigating to /delayed-loading-plain?delay=1500'
		)

		// and the navigation still completes once the data lands
		await page.waitForURL(/delay=1500/)
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
		await expect(page.locator('#nav-status')).toHaveText('idle')
	})

	test('client nav: a fast navigation swaps immediately', async ({ page }) => {
		await goto(page, routes.delayed_loading_plain + '?delay=1500')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')

		await page.click('#to-fast')
		await page.waitForURL(/delay=0/)
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
	})
})
