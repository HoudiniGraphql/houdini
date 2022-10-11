import type { Page_User_BirthVariables as variables } from './$houdini';

// should be gone with https://github.com/HoudiniGraphql/houdini/issues/372
export const Page_User_BirthVariables: variables = ({ params }) => {
  return { userId: params.userId };
};
