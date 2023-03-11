import { graphql } from '$houdini';

export const _houdini_load = [
  graphql`
    query ListLoadQuery1 {
      user(id: "1", snapshot: "list-load-query") {
        id
      }
    }
  `,
  graphql`
    query ListLoadQuery2 {
      user(id: "2", snapshot: "list-load-query") {
        id
      }
    }
  `
];
