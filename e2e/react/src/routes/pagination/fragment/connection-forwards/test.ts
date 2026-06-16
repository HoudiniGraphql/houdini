import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('forwards cursor fragment paginated query', () => {
	test('loadNextPage appends data', async ({ page }) => {
		await goto(page, routes.pagination_fragment_cursor_forwards)

		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')

		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(
			page,
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
		)
	})
})
