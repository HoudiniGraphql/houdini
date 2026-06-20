import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

// one ordered flow so the cases don't depend on a shared, mutated snapshot across tests:
// initial render through a single useFragment, a single-member cache update reflecting in
// place, and an insert growing the list.
test('@plural fragment renders the list and reacts to updates and inserts', async ({ page }) => {
	await goto(page, routes.plural_fragment)

	// initial render: the whole list comes through a single useFragment call
	await expect(page.locator('#plural-list li')).toHaveCount(4)
	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Bruce Willis')
	await expect(page.getByTestId('plural_fragment:2')).toHaveText('Samuel Jackson')

	// updating one record updates just that row, leaving the others untouched
	await page.click('[data-test-action="update-first"]')
	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Updated Bruce')
	await expect(page.getByTestId('plural_fragment:2')).toHaveText('Samuel Jackson')
	await expect(page.locator('#plural-list li')).toHaveCount(4)

	// inserting a record grows the rendered list
	await page.click('[data-test-action="add-new"]')
	await expect(page.locator('#plural-list li')).toHaveCount(5)
	await expect(page.locator('#plural-list li').first()).toHaveText('Brand New User')
})
