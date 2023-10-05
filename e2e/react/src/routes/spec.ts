import { test } from '@playwright/test'
import { expect } from '@playwright/test'

// import { routes } from '../utils/routes'
// import { expect_to_be } from '../utils/testsHelper'

test('Integration has the right title, we can start 🚀', async ({ page }) => {
	// await page.goto(routes.Home)
	await page.goto('/')

	// await expect_to_be(page, "Houdini's SvelteKit Interation tests", 'h1')
	const result = await page.locator('h1').textContent({ timeout: 2998 })
	expect(result).toBe("Houdini's React Interation tests")
})
