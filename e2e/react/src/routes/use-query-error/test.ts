import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// A useQuery whose fetch errors must surface the GraphQL error at the route's error
// boundary — on a full (server-rendered) load and on a client-side navigation alike.
test.describe('useQuery error', () => {
	test('full load surfaces the error at the boundary', async ({ page }) => {
		await page.goto(routes.use_query_error)

		await expect(page.locator('#error-message')).toHaveText('User not found')
	})

	test('client-side navigation surfaces the error at the boundary', async ({ page }) => {
		await goto(page, routes.hello)

		await page.click('text="use_query_error"')
		await expect(page.locator('#error-message')).toHaveText('User not found')
	})
})
