import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query OffsetPaginationQuery {
      usersList(limit: 2, snapshot: "pagination-query-offset") @paginate {
        name
      }
    }
`)
