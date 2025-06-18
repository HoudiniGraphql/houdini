import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query query_with_blocking_disable @blocking_disable {
    user(id: 1, snapshot: "with_blocking_disable", delay: 1000) {
      id
      name
    }
  }
`)
