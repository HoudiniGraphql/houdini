import type { BeforeLoad } from './$houdini';

export const beforeLoad: BeforeLoad = ({ data }) => {
  return {
    message: 'hello'
  };
};
