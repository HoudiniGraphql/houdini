import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query AorB {
    aOrB @list(name: "All_AorB") {
      ... on A {
        id
        a
      }
      ... on B {
        id
        b
      }
    }
  }
`)
