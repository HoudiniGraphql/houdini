import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query PreprocessorTestQueryScalars {
    user(id: "1", snapshot: "preprocess-query-scalars") {
      id
      birthDate
    }
  }
`);
