import { graphql } from '$houdini';
import type { CustomFunctionRouteParamsUserQueryVariables } from './$houdini';

export const _houdini_load = graphql(`
  query CustomFunctionRouteParamsUserQuery($snapshot: String! = "test", $id: ID! = "1") {
    user(id: $id, snapshot: $snapshot) {
      name
    }
  }
`);

export const _CustomFunctionRouteParamsUserQueryVariables: CustomFunctionRouteParamsUserQueryVariables =
  () => {
    return {
      id: '2'
    };
  };
