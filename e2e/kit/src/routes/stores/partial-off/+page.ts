import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query PartialOff @cache(partial: false) {
    user(id: "1", snapshot: "partial-off") {
      id
      birthDate
    }
  }
`);
