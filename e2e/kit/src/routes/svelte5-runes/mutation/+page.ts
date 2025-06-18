import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query Svelte5MutationGetData {
    user(id: "1", snapshot: "svelte-5-mutation") {
      name
    }
  }
`)
