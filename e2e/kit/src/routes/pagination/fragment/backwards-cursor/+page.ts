import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query UserFragmentBackwardsCursorQuery {
    user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
      ...BackwardsCursorFragment
    }
  }
`);
