import { graphql } from '$houdini'
import type { PageLoad } from './$types'

const store = graphql(`
    query ConditionalFragmentSpreadQuery {
        user(id: "1", snapshot: "conditional-fragment-spread") {
            id
            name

            ...ConditionalFragmentSpreadDetails @mask_disable @include(if: false)
        }
    }
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		ConditionalFragmentSpreadQuery: store,
	}
}
