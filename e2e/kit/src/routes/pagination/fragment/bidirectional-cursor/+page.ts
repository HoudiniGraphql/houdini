import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserFragmentBidirectionalCursorQuery {
        user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
            ...BidirectionalCursorFragment
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserFragmentBidirectionalCursorQuery: store
    }
};
