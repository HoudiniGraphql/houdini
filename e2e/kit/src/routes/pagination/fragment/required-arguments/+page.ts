import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query UserFragmentRequiredArgsQuery(
    $snapshot: String! = "pagination-fragment-required-arguments"
  ) {
    user(id: "1", snapshot: $snapshot) {
      id
      name

      ...TestFragment @with(snapshot: $snapshot)
    }
  }
`)
