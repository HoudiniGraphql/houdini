import { expect, test } from '@playwright/test'

import { routes } from '~/utils/routes'
import { sleep } from '~/utils/sleep'
import { goto } from '~/utils/testsHelper.js'

test('_update updates existing list member in place', async ({ page }) => {
	await goto(page, routes.list_operations_update)

	const rows = page.getByTestId('user-row')
	const initialCount = await rows.count()
	expect(initialCount).toBeGreaterThan(0)

	const initialFirstName = await rows.first().textContent()

	await page.click('[data-test-action="update-existing"]')
	await sleep(300)

	expect(await rows.count()).toBe(initialCount)
	expect(await rows.first().textContent()).toBe('updated name')
	expect(await rows.first().textContent()).not.toBe(initialFirstName)
})

test('_update does not insert records that are not in the list', async ({ page }) => {
	await goto(page, routes.list_operations_update)

	const rows = page.getByTestId('user-row')
	const initialCount = await rows.count()

	await page.click('[data-test-action="update-non-member"]')
	await sleep(300)

	expect(await rows.count()).toBe(initialCount)
	expect(page.getByText('Should Not Appear')).not.toBeVisible()
})
