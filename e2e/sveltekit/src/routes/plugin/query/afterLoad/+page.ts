import type { AfterLoadEvent } from './$houdini';

export const _afterLoad = ({ data }: AfterLoadEvent) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
