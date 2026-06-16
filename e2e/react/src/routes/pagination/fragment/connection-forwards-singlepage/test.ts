import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('forwards cursor fragment single page paginated query', () => {
	test('loadNextPage replaces data', async ({ page }) => {
		await goto(page, routes.pagination_fragment_cursor_forwards_singlepage)

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
