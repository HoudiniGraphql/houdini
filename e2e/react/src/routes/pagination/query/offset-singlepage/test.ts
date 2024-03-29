import { expect, test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_1_gql, expect_to_be, goto } from '~/utils/testsHelper.js'

test.describe('offset paginatedQuery', () => {
	test('loadNextPage', async ({ page }) => {
		await goto(page, routes.pagination_query_offset_singlepage)

		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')

		// wait for the api response
		await expect_1_gql(page, 'button[id=next]')

		// make sure we got the new page
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')

		// wait for the api response
		await expect_1_gql(page, 'button[id=next]')

		// make sure we got the new page
		await expect_to_be(page, 'Will Smith, Harrison Ford')
	})
})
