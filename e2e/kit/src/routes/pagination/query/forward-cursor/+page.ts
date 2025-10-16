import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query ForwardCursorPaginationQuery {
        usersConnection(first: 2, snapshot: "pagination-query-forwards-cursor") @paginate {
            edges {
                node {
                    name
                }
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        ForwardCursorPaginationQuery: store
    }
};
