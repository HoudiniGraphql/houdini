import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query LoadingStateTestQuery {
    city(id: "1", delay: 2000) @loading {
      id
      name @loading

      ...CityInfoWithLoadingState @loading
    }
  }
`)
