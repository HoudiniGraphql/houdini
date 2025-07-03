import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query LayoutTestQuery {
    user(id: "1", snapshot: "preprocess-query-simple") {
      name
    }
  }
`);
