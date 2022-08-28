import { graphql } from '$houdini';
import { OnErrorEvent } from './$houdini';

export const houdini_load = graphql`
  query PreprocessorOnErrorTestQuery {
    user(id: "1", snapshot: "preprocess-on-error-test-simple") {
      name
    }
  }
`;

export const onError = ({ error, input }: OnErrorEvent) => {
  return {
    fancyMessage: 'hello'
  };
};
