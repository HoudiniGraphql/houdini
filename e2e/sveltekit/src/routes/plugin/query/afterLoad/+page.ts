import type { AfterLoadEvent } from './$houdini';

export const _houdini_afterLoad = ({ data }: AfterLoadEvent) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
