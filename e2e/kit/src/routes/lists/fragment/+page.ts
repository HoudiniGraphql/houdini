import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query ListUsers {
    usersConnection(snapshot: "users-list-fragment") @list(name: "UsersList") {
      edges {
        node {
          name
          ...UserListItem
        }
      }
    }
  }
`)
