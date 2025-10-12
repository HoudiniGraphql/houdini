import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query Svelte5UsersList {
    usersConnection(first: 2, snapshot: "svelte-5") @paginate {
      edges {
        node {
          ...Svelte5UserDetails
        }
      }
    }
  }
`);
