import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, locator_click, goto } from '~/utils/testsHelper.js'

test.describe('backwards-only cursor single page paginated query', () => {
	test('loadNextPage via cursor stack (no forwards API support)', async ({ page }) => {
		await goto(page, routes.pagination_query_backwards_cursor_singlepage)

		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasNextPage":false`)
		await expectToContain(page, `"hasPreviousPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasNextPage":true`)
		await expectToContain(page, `"hasPreviousPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasNextPage":true`)
		await expectToContain(page, `"hasPreviousPage":true`)

		// Cursor stack re-issues a backward query with the prior cursor
		await locator_click(page, 'button[id=next]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasNextPage":true`)
		await expectToContain(page, `"hasPreviousPage":true`)

		await locator_click(page, 'button[id=next]')
		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasNextPage":false`)
		await expectToContain(page, `"hasPreviousPage":true`)
	})
})
