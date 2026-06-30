import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { goto } from '~/utils/testsHelper.js'

test('@plural fragment re-binds to a new set of parents and tears down old subscriptions', async ({
	page,
}) => {
	await goto(page, routes.plural_fragment_rebind)
	await expect(page.locator('#plural-list li')).toHaveCount(4)

	// re-bind the fragment to just the first two members
	await page.click('[data-test-action="show-first-two"]')
	await expect(page.locator('#plural-list li')).toHaveCount(2)
	await expect(page.getByTestId('plural_rebind:1')).toHaveText('Bruce Willis')

	// update a record that is no longer bound. its subscription should have been torn down,
	// so the rendered subset must not change (no extra row, no leaked value).
	await page.click('[data-test-action="update-last"]')
	await expect(page.locator('#plural-list li')).toHaveCount(2)
	await expect(page.getByText('Off Screen Update')).toHaveCount(0)
})
