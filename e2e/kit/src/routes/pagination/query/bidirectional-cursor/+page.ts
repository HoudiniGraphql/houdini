import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query BidirectionalCursorPaginationQuery {
        usersConnection(
            after: "YXJyYXljb25uZWN0aW9uOjE="
            first: 2
            snapshot: "pagination-query-bdiriectional-cursor"
        ) @paginate {
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
        BidirectionalCursorPaginationQuery: store
    }
};
