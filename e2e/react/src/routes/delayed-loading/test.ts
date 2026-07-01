import { test, expect } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// The router shows a route's @loading state on navigation only once a transition has been
// pending longer than `router.loadingDelay`, and once shown it holds it for at least
// `router.minDuration` (both set in houdini.config.ts). Fast navigations swap straight to
// the new page with no flash; a layout query that doesn't change is never re-loaded, so its
// chrome stays live. The `delay` search param drives the page query's latency so a single
// route can exercise fast and slow navigations. #name = 'loading' while pending, else the
// resolved name; #chrome is the layout query.
test.describe('delayed loading state', () => {
	// a slow client-side navigation surfaces the loading state (after loadingDelay) and then
	// resolves to the data.
	test('client nav: a slow navigation shows the loading state', async ({ page }) => {
		await goto(page, routes.delayed_loading + '?delay=0')
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')

		await page.click('#to-slow')
		await expect(page.locator('#name:visible')).toHaveText('loading')
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')
	})

	// a navigation that resolves before loadingDelay never shows the loading state — React
	// holds the current page until the next one is ready.
	test('client nav: a fast navigation never shows the loading state', async ({ page }) => {
		await goto(page, routes.delayed_loading + '?delay=1500')
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')

		await page.click('#to-fast')
		await page.waitForURL(/delay=0/)
		await expect(page.locator('#name:visible')).not.toHaveText('loading')
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')
	})

	// the layout query has no variables, so a navigation that only changes the page query
	// doesn't re-load it: its chrome stays live (never flips to loading) while the page below
	// shows its loading state.
	test('client nav: the layout query stays live during a slow navigation', async ({ page }) => {
		await goto(page, routes.delayed_loading + '?delay=0')
		await expect(page.locator('#chrome:visible')).toHaveText('Bruce Willis')

		await page.click('#to-slow')
		await expect(page.locator('#name:visible')).toHaveText('loading')
		await expect(page.locator('#chrome:visible')).toHaveText('Bruce Willis')
	})

	// once shown, the loading state is held for at least minDuration even though the response
	// (delay 200ms) lands well before it — otherwise a response just past loadingDelay would
	// cause a skeleton flicker. Timing-based, so this asserts a generous lower bound.
	test('client nav: the loading state is held for at least minDuration', async ({ page }) => {
		await goto(page, routes.delayed_loading + '?delay=0')
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')

		await page.click('#to-min')
		await expect(page.locator('#name:visible')).toHaveText('loading')
		const shownAt = Date.now()
		await expect(page.locator('#name:visible')).toHaveText('Bruce Willis')
		const heldFor = Date.now() - shownAt
		// minDuration is 600ms in config; assert a generous lower bound to avoid CI flake.
		expect(heldFor).toBeGreaterThanOrEqual(400)
	})
})
