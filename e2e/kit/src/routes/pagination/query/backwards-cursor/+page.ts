import { graphql } from '$houdini'

export const _houdini_load = graphql(`
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
