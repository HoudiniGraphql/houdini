import { graphql } from '$houdini'
import type { PageLoad } from './$types'

const store = graphql(`
	query MixedTypeMapQuery {
		userResult(id: "1", snapshot: "abstract-typemap", forceMessage: false) {
			... on Node {
				id
			}
			... on User {
				name
			}
		}
	}
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		MixedTypeMapQuery: store,
	}
}
