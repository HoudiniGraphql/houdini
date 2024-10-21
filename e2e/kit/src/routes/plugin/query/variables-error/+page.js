import { error } from '@sveltejs/kit';

export function _PreprocessorTestQueryErrorVariables() {
  error(403, 'test');
}
