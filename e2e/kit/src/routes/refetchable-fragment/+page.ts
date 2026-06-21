import type { PageLoad } from './$types'
import { graphql } from '$houdini'

const store = graphql(`
    query RefetchableFragmentQuery {
        user(id: "1", snapshot: "refetchable-fragment") {
            ...RefetchableUserInfo @with(size: 50, param: true)
        }
    }
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		RefetchableFragmentQuery: store,
	}
}
