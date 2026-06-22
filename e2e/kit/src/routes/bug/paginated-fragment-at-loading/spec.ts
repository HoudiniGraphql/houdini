import { test } from '@playwright/test'
import { routes } from '../../../lib/utils/routes.js'
import {
	clientSideNavigation,
	expect_0_gql,
	expect_1_gql,
	expect_to_be,
	goto,
} from '../../../lib/utils/testsHelper.js'

test.describe('paginated fragment under a document-level @loading query', () => {
	// issue #1408: a @paginate fragment spread on an @loading query. The child is rendered
	// unguarded, so its pagination handlers can be invoked while the parent entity is still a
	// PendingValue placeholder. They must no-op then (instead of firing node(id: PendingValue))
	// and resume working once @loading resolves — all without an `if (!loading)` guard.
	test('no-ops while loading, renders and paginates after', async ({ page }) => {
		// must navigate client-side to actually see the @loading frame
		await goto(page, routes.Home)
		await clientSideNavigation(page, routes.paginated_fragment_at_loading)

		// we're in the loading frame
		await expect_to_be(page, 'loading...', '#name')

		// clicking next while the parent is still loading must not fire a request
		await expect_0_gql(page, 'button[id=next]')

		// once @loading resolves the friends render
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson', '#result')

		// and pagination works from there
		await expect_1_gql(page, 'button[id=next]')
		await expect_to_be(page, 'Bruce Willis, Samuel Jackson, Morgan Freeman, Tom Hanks', '#result')
	})
})
