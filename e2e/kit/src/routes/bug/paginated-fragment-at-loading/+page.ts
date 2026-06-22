import type { PageLoad } from './$types'
import { graphql } from '$houdini'

// issue #1408: a @paginate fragment spread on a document-level @loading query. the fragment
// itself carries no @loading; it relies on the query-level @loading cascading into the spread.
const store = graphql(`
	query PaginatedFragmentAtLoading @loading {
		user(id: "1", snapshot: "paginated-fragment-at-loading", delay: 2000) {
			name
			...PaginatedFragmentAtLoading_Friends
		}
	}
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		PaginatedFragmentAtLoading: store,
	}
}
