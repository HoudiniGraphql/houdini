import type { PageLoad } from './$types'
import { graphql } from '$houdini'

const store = graphql(`
    query RefetchableCustomQuery {
        refetchableEntity(id: "1") {
            ...RefetchableEntityInfo @with(size: 50)
        }
    }
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		RefetchableCustomQuery: store,
	}
}
