import type { AfterLoad } from './$houdini';

export const afterLoad: AfterLoad = ({ data }) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
