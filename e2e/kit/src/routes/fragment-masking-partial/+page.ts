import { graphql } from '$houdini'

export const _houdini_load = graphql(`
    query FragmentDataNullPageQuery @cache(partial: false) {
      city(id: "1") {
        id
        name

        ...CityDetails
      }
    }
`)



