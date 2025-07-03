import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query Directives {
    user(id: "1", snapshot: "directives") {
      name
    }
    cities @include(if: false) {
      name
    }
    hello @skip(if: true)
  }
`);
