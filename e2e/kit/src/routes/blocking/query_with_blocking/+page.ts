import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query query_with_blocking @blocking {
    user(id: 1, snapshot: "with_blocking", delay: 1000) {
      id
      name
    }
  }
`)
