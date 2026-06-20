import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('@plural fragment renders the whole list through a single useFragment', async ({ page }) => {
	await goto(page, routes.plural_fragment)

	// every user in the snapshot should be rendered
	const items = await page.locator('#plural-list li').all()
	expect(items.length).toBe(4)

	// the masked fragment data should be readable for each item
	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Bruce Willis')
	await expect(page.getByTestId('plural_fragment:2')).toHaveText('Samuel Jackson')
})

test('@plural fragment reacts to a cache update on a single list member', async ({ page }) => {
	await goto(page, routes.plural_fragment)

	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Bruce Willis')

	// update a single record in the cache; only that row should change
	await page.click('[data-test-action="update-first"]')

	await expect(page.getByTestId('plural_fragment:1')).toHaveText('Updated Bruce')
	// the other members and the list length are untouched
	await expect(page.getByTestId('plural_fragment:2')).toHaveText('Samuel Jackson')
	expect((await page.locator('#plural-list li').all()).length).toBe(4)
})

test('@plural fragment reacts to a record inserted into the list', async ({ page }) => {
	await goto(page, routes.plural_fragment)

	await expect(page.locator('#plural-list li')).toHaveCount(4)

	// prepend a new member; the plural fragment should pick up the larger list
	await page.click('[data-test-action="add-new"]')

	await expect(page.locator('#plural-list li')).toHaveCount(5)
	await expect(page.locator('#plural-list li').first()).toHaveText('Brand New User')
})
