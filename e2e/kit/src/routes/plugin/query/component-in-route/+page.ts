import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query ComponentInRoute_Route {
    usersList(limit: 2, snapshot: "ComponentInRoute") {
      id
    }
  }
`)
