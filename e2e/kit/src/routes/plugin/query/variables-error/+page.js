import { graphql } from '$houdini';
import { error } from '@sveltejs/kit';

export function _PreprocessorTestQueryErrorVariables() {
  error(403, 'test');
}

export const _houdini_load = graphql(`
  query PreprocessorTestQueryError($id: ID!) {
    user(id: $id, snapshot: "preprocess-query-variable") {
      name
    }
  }
`);
