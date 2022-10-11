import type { Page_UserVariables as variables } from './$houdini';

// should be gone with https://github.com/HoudiniGraphql/houdini/issues/372
export const Page_UserVariables: variables = ({ params }) => {
  return { userId: params.userId };
};
