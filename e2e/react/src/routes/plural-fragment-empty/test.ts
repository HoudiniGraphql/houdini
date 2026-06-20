import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('@plural fragment renders an empty list as an empty array', async ({ page }) => {
	await goto(page, routes.plural_fragment_empty)

	// the list (#plural-list) renders with no items — data is [] rather than null
	// (an empty <ul> has no size, so assert it's attached rather than "visible")
	await expect(page.locator('#plural-list')).toBeAttached()
	await expect(page.locator('#plural-list li')).toHaveCount(0)
})
