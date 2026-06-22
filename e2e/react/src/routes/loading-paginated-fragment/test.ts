import { test } from '@playwright/test'
import { routes } from '~/utils/routes.js'
import {
	clientSideNavigation,
	expect_0_gql,
	expect_1_gql,
	expect_to_be,
	goto,
} from '~/utils/testsHelper.js'

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

	// the pagination handlers must no-op while the parent entity is still a PendingValue
	// placeholder, instead of firing a node(id: PendingValue) request. the loading frame is
	// only observable via a client-side navigation (a direct load streams until resolved).
	test('paginating during the loading frame is a no-op', async ({ page }) => {
		await goto(page, '/')
		await clientSideNavigation(page, routes.loading_paginated_fragment)

		// we're in the loading frame
		await expect_to_be(page, 'loading', '#name')

		// clicking next while the parent is still loading must not fire a request
		await expect_0_gql(page, 'button[id=next]')

		// once @loading resolves the friends render (the #result node is present but empty
		// during loading, so wait for the data before asserting) and pagination works
		await page.waitForFunction(() =>
			document.querySelector('#result')?.textContent?.includes('Bruce')
		)
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson', '#result')
		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks', '#result')
	})
})
