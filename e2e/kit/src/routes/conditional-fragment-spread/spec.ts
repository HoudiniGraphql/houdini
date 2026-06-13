import { test } from '@playwright/test'
import { routes } from '../../lib/utils/routes.js'
import { expect_to_be, goto } from '../../lib/utils/testsHelper.js'

test.describe('@include on a fragment spread', () => {
	test('a falsy condition does not bubble null up to the parent', async ({ page }) => {
		await goto(page, routes.conditional_fragment_spread)

		await expect_to_be(page, 'conditional-fragment-spread:1:Bruce Willis')
	})
})
