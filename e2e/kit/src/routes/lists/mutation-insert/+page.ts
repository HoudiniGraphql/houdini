import { graphql } from '$houdini'
import type { UsersListMutationInsertUsersVariables } from './$houdini';

export const _houdini_load = graphql(`
  query UsersListMutationInsertUsers($someParam: Boolean!) {
    usersConnection(first: 5, snapshot: "users-list-mutation-insert") @list(name: "MyList") {
      edges {
        node {
          id
          name
          testField(someParam: $someParam)
        }
      }
    }
  }
`)

export const _UsersListMutationInsertUsersVariables: UsersListMutationInsertUsersVariables = () => {
  return {
    someParam: true
  };
};
