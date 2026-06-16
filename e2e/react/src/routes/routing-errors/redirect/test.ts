import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('redirect() navigates to the target URL', async ({ page }) => {
	await goto(page, routes.routing_errors_redirect)
	await expect(page).toHaveURL(routes.routing_errors_redirect_target)
	await expect(page.locator('#result')).toHaveText('redirect target reached')
})
