import { graphql } from '$houdini'

export const _houdini_load = graphql(`
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
