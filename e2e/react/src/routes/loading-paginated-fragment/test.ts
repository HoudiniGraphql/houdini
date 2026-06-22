import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import { expect_to_be, expect_1_gql, goto } from '~/utils/testsHelper.js'

test.describe('paginated fragment under an @loading query', () => {
	// issue #1408: a paginated fragment spread on an @loading query mounts during the
	// loading frame. once the parent query resolves the list should appear and paginate,
	// without the user having to guard the component behind an `if (!loading)` check.
	test('renders and paginates after loading resolves (no guard)', async ({ page }) => {
		await goto(page, routes.loading_paginated_fragment)

		// first page arrives with the parent query once @loading resolves
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson')

		// and pagination keeps working from there
		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks')
	})
})
