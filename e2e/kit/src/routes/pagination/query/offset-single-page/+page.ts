import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OffsetPaginationSinglePageQuery {
        usersList(limit: 2, snapshot: "pagination-query-offset-single-page")
            @paginate(mode: SinglePage) {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        OffsetPaginationSinglePageQuery: store
    }
};
