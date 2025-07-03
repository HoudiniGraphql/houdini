import type { PreprocessorTestQueryVarsVariables as Variables } from './$houdini';
import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query PreprocessorTestQueryVars($id: ID!) {
    user(id: $id, snapshot: "preprocess-query-variable") {
      name
    }
  }
`);

export const _PreprocessorTestQueryVarsVariables: Variables = async ({ params }) => {
  return {
    id: params.id || '1'
  };
};
