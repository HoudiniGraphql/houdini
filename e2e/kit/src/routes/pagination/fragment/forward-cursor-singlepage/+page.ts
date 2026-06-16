import type { PageLoad } from './$types'
import { graphql } from '$houdini'

const store = graphql(`
    query UserFragmentForwardsCursorSinglePageQuery {
        user(id: "1", snapshot: "pagination-fragment-forwards-cursor-singlepage-svelte") {
            ...ForwardsCursorSinglePageFragment
        }
    }
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		UserFragmentForwardsCursorSinglePageQuery: store,
	}
}
