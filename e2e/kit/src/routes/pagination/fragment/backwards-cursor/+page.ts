import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserFragmentBackwardsCursorQuery {
        user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
            ...BackwardsCursorFragment
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserFragmentBackwardsCursorQuery: store
    }
};
