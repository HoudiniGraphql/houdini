import { graphql } from '$houdini';

import type { OnErrorEvent } from './$houdini';

export const _houdini_load = graphql`
  query PreprocessorOnErrorTestQuery {
    user(id: "1000", snapshot: "preprocess-on-error-test-simple") {
      name
    }
  }
`;

export const _houdini_onError = (event: OnErrorEvent) => {
  return {
    errorMessage: event.error.body.message,
    fancyMessage: 'hello'
  };
};
