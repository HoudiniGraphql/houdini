import { graphql, HelloStore } from '$houdini';

export const _houdini_load = [
  new HelloStore(),
  graphql`
    query InlineAndGlobalLoadQuery2 {
      user(id: "2", snapshot: "inline-and-global-load") {
        id
      }
    }
  `
];
