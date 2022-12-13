import { graphql } from '$houdini';

export const _houdini_load = graphql`
  query PreprocessorOnErrorTestQuery {
    user(id: "1000", snapshot: "preprocess-on-error-test-simple") {
      name
    }
  }
`;

export const _houdini_onError = () => {
  return {
    fancyMessage: 'hello'
  };
};
