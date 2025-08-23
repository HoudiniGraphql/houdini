import { graphql, load_TestMutationUpdateUsersList } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return {
    ...(await load_TestMutationUpdateUsersList({ event }))
  };
}

graphql(`
  query TestMutationUpdateUsersList {
    usersList(limit: 5, snapshot: "update-user-mutation") {
      id
      name
      ...UserInfo
    }
  }
`);
