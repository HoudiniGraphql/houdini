import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query UserFragmentOffsetQuery {
    user(id: "1", snapshot: "pagination-fragment-offset") {
      ...OffsetFragment
    }
  }
`);
