import { routes } from '../../../lib/utils/routes.js'
import { expect_1_gql, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js'
import { test, expect } from '@playwright/test'

test.describe('bug/refetch-cache-links-leak', () => {
	test('refetching a connection does not duplicate embedded cache links', async ({ page }) => {
		await goto_expect_n_gql(page, routes.Bug_RefetchCacheLinksLeak, 1)

		const countEl = page.locator('div[id="edge-link-count"]')

		const initialCount = parseInt((await countEl.textContent()) ?? '0')
		expect(initialCount).toBeGreaterThan(0)

		await expect_1_gql(page, 'button[id="refetch"]')

		const afterCount = parseInt((await countEl.textContent()) ?? '0')
		expect(afterCount).toBe(initialCount)
	})
})
