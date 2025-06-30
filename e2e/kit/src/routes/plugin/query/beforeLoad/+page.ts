import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query PreprocessorBeforeLoadTestQuery {
      user(id: "1", snapshot: "preprocess-before-load-test-simple") {
        name
      }
    }
`)

export const _houdini_beforeLoad = () => {
  return {
    message: 'hello'
  };
};


