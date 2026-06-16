import { test } from '@playwright/test'
import { routes } from '../../../lib/utils/routes.js'
import { expect_1_gql, expect_to_be, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js'

test.describe('cache refresh', () => {
	test('refreshing a record refetches the query that contains it', async ({ page }) => {
		// load the page and wait for the initial query
		await goto_expect_n_gql(page, routes.Cache_Refresh, 1)

		// the fragment renders the user's name. the query only contains the
		// user behind the fragment's mask
		await expect_to_be(page, 'Bruce Willis', 'div[id=user-name]')

		// refreshing the user record triggers exactly one network request:
		// the query that contains it refetches itself
		await expect_1_gql(page, 'button[id=refresh]')

		// and the data is still rendered after the round trip
		await expect_to_be(page, 'Bruce Willis', 'div[id=user-name]')
	})
})
