import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query OffsetVariablePaginationQuery($limit: Int!) {
    usersList(limit: $limit, snapshot: "pagination-query-offset-variables") @paginate {
      name
    }
  }
`);

export function _OffsetVariablePaginationQueryVariables() {
  return {
    limit: 2
  };
}
