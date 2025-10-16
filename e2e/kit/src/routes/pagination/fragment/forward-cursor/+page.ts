import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserFragmentForwardsCursorQuery {
        user(id: "1", snapshot: "pagination-fragment-forwards-cursor") {
            ...ForwardsCursorFragment
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserFragmentForwardsCursorQuery: store
    }
};
