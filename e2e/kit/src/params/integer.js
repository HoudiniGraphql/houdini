import { MyEnum } from '$houdini';
// this is here to silence the warning that MyEnum isn't being used :facepalm:
// eslint-disable-next-line
MyEnum;

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return /^\d+$/.test(param);
}
