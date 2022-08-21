import type { BeforeLoadEvent } from './$houdini';

export const beforeLoad = (event: BeforeLoadEvent) => {
  return {
    message: 'hello'
  };
};
