import type { AfterLoadEvent } from './$houdini';

export const afterLoad = ({ data }: AfterLoadEvent) => {
  return {
    message: data.PreprocessorAfterLoadTestQuery.user.name[0]
  };
};
