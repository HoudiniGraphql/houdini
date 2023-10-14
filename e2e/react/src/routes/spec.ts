import { test } from '@playwright/test'

import { routes } from '../utils/routes.js'
import { expect_to_be } from '../utils/testsHelper.js'

test('Integration has the right title, we can start 🚀', async ({ page }) => {
	await page.goto(routes.Home)

	await expect_to_be(page, "Houdini's React Interation tests", 'h1')
})
