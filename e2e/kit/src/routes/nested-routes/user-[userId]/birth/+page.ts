import { graphql } from '$houdini'
import type { Page_User_BirthVariables as variables } from './$houdini';

export const _houdini_load = graphql(`
  query Page_User_Birth($userId: ID!) {
    user(id: $userId, snapshot: "Page_User", delay: 1000) {
      id
      birthDate
    }
  }
`)

// should be gone with https://github.com/HoudiniGraphql/houdini/issues/372
export const _Page_User_BirthVariables: variables = ({ params }) => {
  return { userId: params.userId };
};
