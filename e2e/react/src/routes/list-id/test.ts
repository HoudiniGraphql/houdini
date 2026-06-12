import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { sleep } from '~/utils/sleep'
import { goto } from '~/utils/testsHelper.js'

test('@listID inserts into an embedded list with no natural parent ID', async ({ page }) => {
	await goto(page, routes.list_id)

	const rows = page.getByTestId('user-row')
	const initialCount = await rows.count()
	expect(initialCount).toBeGreaterThan(0)

	await page.click('[data-test-action="add"]')
	await sleep(300)

	expect(await rows.count()).toBe(initialCount + 1)

	// the new user should appear in the list
	const lastRow = rows.last()
	expect(await lastRow.textContent()).toContain('New User')
})
