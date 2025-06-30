import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query OptimisticUserQuery {
      user(id: "1", snapshot: "update-user-mutation") {
        name
      }
    }
`)
