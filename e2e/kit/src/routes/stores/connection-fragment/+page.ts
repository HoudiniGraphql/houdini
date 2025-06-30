import { graphql } from '$houdini'

export const _houdini_load = `
    query UserConnectionFragmentQuery @load {
      user(id: "1", snapshot: "connection-fragment") {
        friendsConnection(first: 2) {
          ...ConnectionFragment
        }
      }
    }
`
