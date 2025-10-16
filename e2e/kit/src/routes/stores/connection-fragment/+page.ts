import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserConnectionFragmentQuery {
        user(id: "1", snapshot: "connection-fragment") {
            friendsConnection(first: 2) {
                ...ConnectionFragment
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserConnectionFragmentQuery: store
    }
};
