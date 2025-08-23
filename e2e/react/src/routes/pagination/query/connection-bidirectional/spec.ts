import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expectToContain, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('bidirectional cursor paginated query', () => {
	test('backwards and then forwards', async ({ page }) => {
		await goto(page, routes.pagination_query_bidirectional)

		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')

		/// Click on the previous button

		// load the previous page and wait for the response
		await expect_1_gql(page, 'button[id=previous]')

		// make sure we got the new content
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')

		// there should be a next page
		await expectToContain(page, `"hasNextPage":true`)
		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":false`)

		/// Click on the next button

		// load the next page and wait for the response
		await expect_1_gql(page, 'button[id=next]')

		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":false`)
		// there should be a next page
		await expectToContain(page, `"hasNextPage":true`)

		// make sure we got the new content
		await expect_to_be(
			page,
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
		)

		/// Click on the next button

		// load the next page and wait for the response
		await expect_1_gql(page, 'button[id=next]')

		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":false`)
		// there should be a next page
		await expectToContain(page, `"hasNextPage":false`)

		// make sure we got the new content
		await expect_to_be(
			page,
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
		)
	})

	test('forwards then backwards and then forwards again', async ({ page }) => {
		await goto(page, routes.pagination_query_bidirectional)

		await expect_to_be(page, 'Morgan Freeman, Tom Hanks')

		/// Click on the next button

		// load the next page and wait for the response
		await expect_1_gql(page, 'button[id=next]')

		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":true`)
		// there should be a next page
		await expectToContain(page, `"hasNextPage":true`)

		// make sure we got the new content
		await expect_to_be(page, 'Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford')

		/// Click on the previous button

		// load the previous page and wait for the response
		await expect_1_gql(page, 'button[id=previous]')

		// make sure we got the new content
		await expect_to_be(
			page,
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford'
		)

		// there should be a next page
		await expectToContain(page, `"hasNextPage":true`)
		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":false`)

		/// Click on the next button

		// load the next page and wait for the response
		await expect_1_gql(page, 'button[id=next]')

		// there should be no previous page
		await expectToContain(page, `"hasPreviousPage":false`)
		// there should be a next page
		await expectToContain(page, `"hasNextPage":false`)

		// make sure we got the new content
		await expect_to_be(
			page,
			'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks, Will Smith, Harrison Ford, Eddie Murphy, Clint Eastwood'
		)
	})
})
