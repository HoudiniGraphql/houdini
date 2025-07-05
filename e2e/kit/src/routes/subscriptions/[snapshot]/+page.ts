import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query SubscriptionTestUserList {
    user(id: "1", snapshot: "subscription-test") {
      name
    }
  }
`);
