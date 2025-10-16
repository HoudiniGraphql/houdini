import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query StubPageQuery {
        user(id: "1", snapshot: "page-query") {
            id
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        StubPageQuery: store
    }
};
