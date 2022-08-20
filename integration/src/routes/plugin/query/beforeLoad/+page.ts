import type { BeforeLoad } from './$houdini';

export const beforeLoad: BeforeLoad = () => {
  return {
    message: 'hello'
  };
};
