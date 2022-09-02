import { graphql } from '$houdini';
import type { OnErrorEvent } from './$houdini';

export const houdini_load = graphql`
  query PreprocessorOnErrorTestQuery {
    user(id: "1000", snapshot: "preprocess-on-error-test-simple") {
      name
    }
  }
`;

export const onError = () => {
  return {
    fancyMessage: 'hello'
  };
};
