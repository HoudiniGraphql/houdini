// This file cannot contain a load function. Jean-Yves will have better content to put here:D

export function PreprocessorTestQueryVarsVariables({ params }) {
  return {
    id: params.id || '1'
  };
}

export const foo = 'a';
