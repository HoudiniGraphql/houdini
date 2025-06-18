import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query Svelte5SimpleSSR {
    user(id: "1", snapshot: "hello-svelte-5") {
      name
      birthDate
    }
  }
`)
