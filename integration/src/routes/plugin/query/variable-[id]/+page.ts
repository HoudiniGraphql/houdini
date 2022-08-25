import type { PreprocessorTestQueryVarsVariables as Variables } from './$houdini';

export const PreprocessorTestQueryVarsVariables: Variables = async ({ params }) => {
  return {
    id: params.id || '1'
  };
};
