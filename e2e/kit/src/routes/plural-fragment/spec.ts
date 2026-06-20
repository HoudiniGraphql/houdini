import { expect, test } from '@playwright/test'
import { routes } from '../../lib/utils/routes.js'
import { goto } from '../../lib/utils/testsHelper.js'

// one exhaustive-enough test: initial render through a single fragment(), a single-member
// cache update reflecting in place, and an insert growing the list.
test('@plural fragment renders a list and reacts to updates and inserts', async ({ page }) => {
	await goto(page, routes.Plural_fragment)

	// initial render: the whole list comes through one fragment() call
	await expect(page.locator('#plural-list li')).toHaveCount(4)
	await expect(page.locator('#plural-list li').first()).toHaveText('Bruce Willis')

	// updating one record updates just that row
	await page.click('[data-test-action="update-first"]')
	await expect(page.locator('#plural-list li').first()).toHaveText('Updated Bruce')
	await expect(page.locator('#plural-list li')).toHaveCount(4)

	// inserting a record grows the rendered list
	await page.click('[data-test-action="add-new"]')
	await expect(page.locator('#plural-list li')).toHaveCount(5)
	await expect(page.locator('#plural-list li').first()).toHaveText('Brand New User')
})
