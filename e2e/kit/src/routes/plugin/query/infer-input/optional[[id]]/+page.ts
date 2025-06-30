import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query OptionalRouteParamsUserQuery($snapshot: String! = "test", $id: ID! = "1") {
    user(id: $id, snapshot: $snapshot) {
      name
    }
  }
`)
