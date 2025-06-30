import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query OffsetPaginationSinglePageQuery {
      usersList(limit: 2, snapshot: "pagination-query-offset-single-page")
        @paginate(mode: SinglePage) {
        name
      }
    }
`)
