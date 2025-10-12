import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query UserConnectionFragmentQuery {
    user(id: "1", snapshot: "connection-fragment") {
      friendsConnection(first: 2) {
        ...ConnectionFragment
      }
    }
  }
`);
