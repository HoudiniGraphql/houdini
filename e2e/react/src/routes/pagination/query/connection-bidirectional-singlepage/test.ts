import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_0_gql, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('bidirectional cursor single page paginated query', () => {
	test('forwards three times then backwards three times', async ({ page }) => {
		await goto(page, routes.pagination_query_bidirectional_cursor_singlepage)

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

		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Eddie Murphy, Clint Eastwood')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":false`)

		// Pages 3 and 2 were fetched going forward — the cache serves them without a network
		// request. Page 1 came from the initial query (different cache key), so it needs one.
		await expect_0_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Will Smith, Harrison Ford')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_0_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')
		await expectToContain(page, `"hasPreviousPage":true`)
		await expectToContain(page, `"hasNextPage":true`)

		await expect_1_gql(page, 'button[id=previous]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')
		await expectToContain(page, `"hasPreviousPage":false`)
		await expectToContain(page, `"hasNextPage":true`)
	})
})
