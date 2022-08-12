export function PreprocessorTestQueryVarsVariables({ params }: { params: { id: string } }) {
  return {
    id: params.id || '1'
  };
}
