import { test } from '@playwright/test'
import { routes } from '../../../../lib/utils/routes.js'
import {
	expect_1_gql,
	expect_to_be,
	expectToContain,
	goto,
} from '../../../../lib/utils/testsHelper.js'

test.describe('forwards cursor fragment single page', () => {
	test('loadNextPage replaces data', async ({ page }) => {
		await goto(page, routes.Pagination_fragment_forward_cursor_singlepage)

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

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasPreviousPage":false`)
		await expectToContain(page, `"hasNextPage":true`)
	})
})
