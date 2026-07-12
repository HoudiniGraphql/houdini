import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto, locator_click } from '~/utils/testsHelper.js'

// error boundaries don't run during SSR: a direct load relies on the on_render retry to
// render the boundary server-side with the routing error's status.
test('SSR: notFound() on a direct load renders the error boundary with 404 status', async ({
	page,
}) => {
	const response = await goto(page, routes.routing_errors_not_found)
	expect(response?.status()).toBe(404)
	await expect(page.locator('#error-message')).toHaveText('routing-error: 404')
})

test('notFound() triggers the error boundary with 404 status', async ({ page }) => {
	await goto(page, routes.routing_errors)
	await locator_click(page, 'a[href="/routing-errors/not-found"]')
	await expect(page.locator('#error-message')).toHaveText('routing-error: 404')
})

test('unmatched URL shows 404 via static prefix matching', async ({ page }) => {
	await goto(page, routes.routing_errors_static_404)
	await expect(page.locator('#error-message')).toHaveText('routing-error: 404')
})
