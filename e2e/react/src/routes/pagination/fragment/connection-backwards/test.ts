import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('backwards cursor fragment paginated query', () => {
	test('loadPreviousPage prepends data', async ({ page }) => {
		await goto(page, routes.pagination_fragment_cursor_backwards)

		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasPreviousPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood')

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(
			page,
			'Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
		)
	})
})
