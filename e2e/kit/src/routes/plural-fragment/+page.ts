import type { PageLoad } from './$types'
import { graphql } from '$houdini'

const store = graphql(`
    query PluralListUsers {
        usersList(snapshot: "plural-fragment", limit: 4) {
            id
            ...PluralUserRow
        }
    }
`)

export const load: PageLoad = async (event) => {
	await store.fetch({ event })

	return {
		PluralListUsers: store,
	}
}
