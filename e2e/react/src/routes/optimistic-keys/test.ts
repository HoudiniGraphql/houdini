import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes'
import { sleep } from '~/utils/sleep'
import { goto } from '~/utils/testsHelper.js'

test('@optimisticKey', async ({ page }) => {
	await goto(page, routes.optimistic_keys)

	// in order for this to work, we should be able to create a new user
	// and then update it immediately
	await page.click('[data-test-action="create"]')

	const getValue = async () => {
		const elements = await page.getByTestId('target')
		return await elements.textContent()
	}

	// the value in the last row should be 'optimistic value 1'
	expect(await getValue()).toBe('optimistic value 1')

	// click on the last list in the row
	await page.click('[data-test-action="update"]')

	// wait a few seconds and make sure there are no errors
	await sleep(300)
	let found = false
	try {
		await page.waitForSelector('[data-error="true"]', { timeout: 100 })
		found = true
	} catch {}

	expect(found).toBe(false)

	// the value in the last row should be 'optimistic value 2'
	expect(await getValue()).toBe('optimistic value 2')

	// wait for the final mutation to resolve
	await sleep(500)

	// the value in the last row should be 'final value'
	expect(await getValue()).toBe('final value')
})

test('@optimisticKey - double click', async ({ page }) => {
	await goto(page, routes.optimistic_keys)

	// all we have to do is double click twice and make sure we didn't get an error when it resolves
	await page.click('[data-test-action="create"]')
	await page.click('[data-test-action="create"]')

	// wait a few seconds and make sure there are no errors
	await sleep(300)

	// wait a few seconds and make sure there are no errors
	await sleep(300)
	let found = false
	try {
		await page.waitForSelector('h1', { timeout: 100 })
		found = true
	} catch {}

	expect(found).toBe(false)
})
