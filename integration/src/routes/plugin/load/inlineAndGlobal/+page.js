import { graphql, GQL_Hello } from '$houdini';

export const houdini_load = [
  GQL_Hello,
  graphql`
    query InlineAndGlobalLoadQuery2 {
      user(id: "2", snapshot: "inline-and-global-load") {
        id
      }
    }
  `
];
