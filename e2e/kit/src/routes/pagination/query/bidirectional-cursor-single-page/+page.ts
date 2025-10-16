import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query BidirectionalCursorSinglePagePaginationQuery(
        $first: Int = 2
        $after: String = "YXJyYXljb25uZWN0aW9uOjE="
        $last: Int
        $before: String
    ) {
        usersConnection(
            first: $first
            after: $after
            last: $last
            before: $before
            snapshot: "pagination-query-bidiriectional-cursor-single-page"
        ) @paginate(mode: SinglePage) {
            edges {
                node {
                    name
                }
            }
            pageInfo {
                endCursor
                hasNextPage
                hasPreviousPage
                startCursor
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        BidirectionalCursorSinglePagePaginationQuery: store
    }
};
