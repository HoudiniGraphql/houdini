import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query ForwardCursorPaginationQuery {
    usersConnection(first: 2, snapshot: "pagination-query-forwards-cursor") @paginate {
      edges {
        node {
          name
        }
      }
    }
  }
`);
