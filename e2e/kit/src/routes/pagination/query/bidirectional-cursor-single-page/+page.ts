import { graphql } from '$houdini'

export const _houdini_load = graphql(`
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
