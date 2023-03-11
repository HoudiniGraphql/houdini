import { error } from '@sveltejs/kit';

export function _PreprocessorTestQueryErrorVariables() {
  throw error(403, 'test');
}
