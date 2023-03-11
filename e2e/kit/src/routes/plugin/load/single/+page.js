import { graphql } from '$houdini';

export const _houdini_load = graphql`
  query SingleLoadQuery {
    user(id: "1", snapshot: "single-load-query") {
      id
    }
  }
`;
