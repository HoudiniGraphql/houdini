import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto, locator_click } from '~/utils/testsHelper.js'

// a thrown redirect() on a direct load can't render anything server-side — on_render
// answers it with a real Location header so the browser lands on the target.
test('SSR: redirect() on a direct load sends the browser to the target', async ({ page }) => {
	await goto(page, routes.routing_errors_redirect)
	await expect(page).toHaveURL(routes.routing_errors_redirect_target)
	await expect(page.locator('#result')).toHaveText('redirect target reached')
})

test('redirect() navigates to the target URL', async ({ page }) => {
	await goto(page, routes.routing_errors)
	await locator_click(page, 'a[href="/routing-errors/redirect"]')
	await expect(page).toHaveURL(routes.routing_errors_redirect_target)
	await expect(page.locator('#result')).toHaveText('redirect target reached')
})
