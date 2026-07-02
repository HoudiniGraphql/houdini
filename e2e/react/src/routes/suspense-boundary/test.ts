import { test, expect } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A hand-rolled Suspense boundary in a layout composes with the router, but with classic
// React semantics rather than the delayed-loading treatment: it catches a frameless
// page's suspension on initial load, it does NOT re-show its fallback on a same-route
// navigation (React holds mounted boundaries through a transition), and on a cross-route
// navigation the freshly-mounted boundary shows its fallback immediately (no
// loadingDelay/minDuration). These tests pin that contract.
test.describe('user suspense boundary in a layout', () => {
	// initial (SSR) load: the shell streams with the user's fallback and the content
	// swaps in when the query resolves
	test('SSR: a slow frameless page streams the user fallback first', async ({ page }) => {
		await page.goto(routes.suspense_boundary + '?delay=800', { waitUntil: 'commit' })
		await expect(page.locator('#user-fallback')).toHaveText('user loading')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
	})

	// same-route nav: the boundary is already mounted, so a transition never re-shows its
	// fallback — the previous page holds until the new data lands
	test('client nav: a same-route navigation holds the page, not the fallback', async ({
		page,
	}) => {
		await goto(page, routes.suspense_boundary + '?delay=0')
		await expect(page.locator('#name')).toHaveText('Bruce Willis')

		await page.click('#to-slow')
		await page.waitForTimeout(400)
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
		await expect(page.locator('#user-fallback')).toHaveCount(0)

		await page.waitForURL(/delay=1500/)
		await expect(page.locator('#name')).toHaveText('Bruce Willis')
	})

	// cross-route nav: the layout (and its boundary) mounts fresh in the transition, and
	// React commits new boundaries with their fallback showing — immediately, with none of
	// the router's delay/min-duration timing. The router's navigation is settled at that
	// commit, so useNavigation reports idle while the user's fallback is still up.
	test('client nav: a cross-route navigation shows the fallback immediately', async ({
		page,
	}) => {
		await goto(page, routes.suspense_boundary_link)

		await page.click('#to-suspense-boundary')
		await expect(page.locator('#user-fallback')).toHaveText('user loading')
		await expect(page.locator('#nav-status')).toHaveText('idle')

		await expect(page.locator('#name')).toHaveText('Bruce Willis')
	})
})
