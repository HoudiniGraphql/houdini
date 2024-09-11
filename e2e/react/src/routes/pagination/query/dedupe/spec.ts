import test, { expect, type Response } from '@playwright/test'
import { routes } from '~/utils/routes'
import { expect_1_gql, expect_to_be, goto } from '~/utils/testsHelper'

test('pagination before previous request was finished', async ({ page }) => {
	await goto(page, routes.pagination_dedupe)

	await expect_to_be(page, 'Bruce Willis, Samuel Jackson')

	// Adapted from `expect_n_gql` in lib/utils/testsHelper.ts
	let nbResponses = 0
	async function fnRes(response: Response) {
		if (response.url().endsWith(routes.api)) {
			nbResponses++
		}
	}

	page.on('response', fnRes)

	// Click the "next page" button twice
	await page.click('button[id=next]')
	await page.click('button[id=next]')

	// Give the query some time to execute
	await page.waitForTimeout(1000)

	// Check that only one gql request happened.
	expect(nbResponses).toBe(1)

	page.removeListener('response', fnRes)

	await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')

	// Fetching the 3rd page still works ok.
	await expect_1_gql(page, 'button[id=next]')
	await expect_to_be(
		page,
		'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
	)
})
