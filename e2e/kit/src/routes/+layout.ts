import { graphql } from '$houdini';

export const _houdini_session = true;

export const _houdini_load = graphql(`
  query LayoutSession {
    session
  }
`);
