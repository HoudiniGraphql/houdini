import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query LayoutCity {
    city(id: "1") {
      id
      name

      # ...CityDetails
    }
  }
`);
