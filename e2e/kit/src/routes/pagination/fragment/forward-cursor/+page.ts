import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query UserFragmentForwardsCursorQuery {
    user(id: "1", snapshot: "pagination-fragment-forwards-cursor") {
      ...ForwardsCursorFragment
    }
  }
`);
