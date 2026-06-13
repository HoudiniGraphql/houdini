import { expect, test } from '@playwright/test'

import { routes } from '~/utils/routes'
import { sleep } from '~/utils/sleep'
import { goto } from '~/utils/testsHelper.js'

test('_upsert updates existing list member without duplicating', async ({ page }) => {
	await goto(page, routes.list_operations_upsert)

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

test('_upsert inserts new record when not already in list', async ({ page }) => {
	await goto(page, routes.list_operations_upsert)

	const rows = page.getByTestId('user-row')
	const initialCount = await rows.count()

	await page.click('[data-test-action="add-new"]')
	await sleep(300)

	expect(await rows.count()).toBe(initialCount + 1)
	expect(await rows.first().textContent()).toBe('Brand New User')
})
