import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('notFound() triggers the error boundary with 404 status', async ({ page }) => {
	await goto(page, routes.routing_errors_not_found)
	await expect(page.locator('#error-message')).toHaveText('routing-error: 404')
})

test('unmatched URL shows 404 via static prefix matching', async ({ page }) => {
	await goto(page, routes.routing_errors_static_404)
	await expect(page.locator('#error-message')).toHaveText('routing-error: 404')
})
