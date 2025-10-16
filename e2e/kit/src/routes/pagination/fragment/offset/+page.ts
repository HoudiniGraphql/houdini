import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserFragmentOffsetQuery {
        user(id: "1", snapshot: "pagination-fragment-offset") {
            ...OffsetFragment
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserFragmentOffsetQuery: store
    }
};
