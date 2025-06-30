import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query NestedFragmentArgs {
    ...UserSearch @with(name: "Bruce")
  }
`)
