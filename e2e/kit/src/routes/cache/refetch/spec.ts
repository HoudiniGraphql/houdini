import { test } from '@playwright/test'
import { routes } from '../../../lib/utils/routes.js'
import { expect_n_gql, expect_to_be, goto_expect_n_gql } from '../../../lib/utils/testsHelper.js'

test.describe('cache @refetch', () => {
	test('a mutation with @refetch refetches the query that depends on the record', async ({
		page,
	}) => {
		// load the page and wait for the initial query
		await goto_expect_n_gql(page, routes.Cache_Refetch, 1)

		// the fragment renders the user's name behind the query's mask
		await expect_to_be(page, 'Bruce Willis', 'div[id=user-name]')

		// clicking fires the mutation and, because the response is tagged with
		// @refetch, the query that depends on the user refetches itself: two
		// network requests in total
		await expect_n_gql(page, 'button[id=mutate]', 2)

		// the refetched query renders the updated name
		await expect_to_be(page, 'Samuel Jackson', 'div[id=user-name]')
	})
})
