import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import {
	expect_to_be,
	expectToContain,
	expect_0_gql,
	expect_1_gql,
	goto,
} from '~/utils/testsHelper.js'

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

		// Page 2 was fetched on the way forward — the cache serves it without a network request.
		await expect_0_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		// Page 1 was the initial load — cache hit, no network request.
		await expect_0_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasPreviousPage":false`)
		await expectToContain(page, `"hasNextPage":true`)
	})
})
