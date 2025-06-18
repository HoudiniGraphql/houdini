import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query PartialOffChild @cache(partial: false) {
    user(id: "1", snapshot: "partial-off") {
      id
      name
    }
  }
`)

