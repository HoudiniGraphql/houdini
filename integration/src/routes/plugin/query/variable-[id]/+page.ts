import type { PreprocessorTestQueryVarsVariables as Variables } from './$houdini';

export const PreprocessorTestQueryVarsVariables: Variables = ({ params }) => {
  return {
    id: params.id || '1'
  };
};
