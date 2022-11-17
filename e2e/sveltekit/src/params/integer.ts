import { MyEnum } from '$houdini';

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return /^\d+$/.test(param);
}
