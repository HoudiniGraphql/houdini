import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import {
	expect_to_be,
	expectToContain,
	expect_0_gql,
	expect_1_gql,
	goto,
} from '~/utils/testsHelper.js'

test.describe('backwards cursor fragment single page paginated query', () => {
	test('loadPreviousPage replaces data then loadNextPage navigates forward', async ({ page }) => {
		await goto(page, routes.pagination_fragment_cursor_backwards_singlepage)

		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":false`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		// "Will Smith, Harrison Ford" was fetched on the way back — served from cache.
		await expect_0_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		// Page 4 was the initial load — cache hit, no network request.
		await expect_0_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":false`)
	})
})
