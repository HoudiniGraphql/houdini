import { graphql } from '$houdini'

export const _houdini_load = graphql(`
   query OptimisticUsersList {
      usersList(snapshot: "mutation-opti-list", limit: 15) @list(name: "OptimisticUsersList") {
        name
      }
    }
`)
