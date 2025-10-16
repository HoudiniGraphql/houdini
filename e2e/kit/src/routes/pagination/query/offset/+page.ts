import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OffsetPaginationQuery {
        usersList(limit: 2, snapshot: "pagination-query-offset") @paginate {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        OffsetPaginationQuery: store
    }
};
