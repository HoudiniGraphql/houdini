import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query Svelte5Pagination {
    usersConnection(first: 2, snapshot: "svelte-5-pagination") @paginate {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`);
