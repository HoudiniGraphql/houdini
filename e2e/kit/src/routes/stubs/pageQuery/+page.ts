import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query StubPageQuery {
    user(id: "1", snapshot: "page-query") {
      id
    }
  }
`)
