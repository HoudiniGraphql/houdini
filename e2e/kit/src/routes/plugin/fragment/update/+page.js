import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query FragmentUpdateTestQuery($id: ID!) {
    node(id: $id) {
      ... on User {
        ...UserFragmentTestFragment
      }
    }
  }
`);

export function _FragmentUpdateTestQueryVariables() {
  return {
    id: 'preprocess-fragment:1'
  };
}
