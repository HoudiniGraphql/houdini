import type { AfterLoad } from './$houdini';

export const afterLoad: AfterLoad = ({ data, event }) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
