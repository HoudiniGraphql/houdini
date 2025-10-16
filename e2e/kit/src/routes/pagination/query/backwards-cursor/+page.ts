import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query BackwardsCursorPaginationQuery {
        usersConnection(last: 2, snapshot: "pagination-query-backwards-cursor") @paginate {
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
        BackwardsCursorPaginationQuery: store
    }
};
