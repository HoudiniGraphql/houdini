import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, locator_click, goto } from '~/utils/testsHelper.js'

test.describe('forwards-only cursor single page paginated query', () => {
	test('loadPreviousPage via cursor stack (no backwards API support)', async ({ page }) => {
		await goto(page, routes.pagination_query_forwards_cursor_singlepage)

		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasPreviousPage":false`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		// Cursor stack re-issues a forward query with the prior cursor
		await locator_click(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await locator_click(page, 'button[id=previous]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasPreviousPage":false`)
		await expectToContain(page, `"hasNextPage":true`)
	})
})
