import type { AfterLoadEvent } from './$houdini';
import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query PreprocessorAfterLoadTestQuery {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
`)

export const _houdini_afterLoad = ({ data }: AfterLoadEvent) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
