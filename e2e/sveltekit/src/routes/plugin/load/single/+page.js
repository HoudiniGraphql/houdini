import { graphql } from '$houdini';

export const houdini_load = graphql`
  query SingleLoadQuery {
    user(id: "1", snapshot: "single-load-query") {
      id
    }
  }
`;
