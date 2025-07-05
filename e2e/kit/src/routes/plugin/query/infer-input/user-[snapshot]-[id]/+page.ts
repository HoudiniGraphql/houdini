import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query RouteParamsUserQuery($snapshot: String!, $id: ID!) {
    user(id: $id, snapshot: $snapshot) {
      name
    }
  }
`);
