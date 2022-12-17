import { graphql, HelloStore } from '$houdini';

const Hello = new HelloStore();

export const _houdini_load = [
  Hello,
  graphql`
    query InlineAndGlobalLoadQuery2 {
      user(id: "2", snapshot: "inline-and-global-load") {
        id
      }
    }
  `
];
