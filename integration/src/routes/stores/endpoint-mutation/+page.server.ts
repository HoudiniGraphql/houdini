import { GQL_AddUser } from '$houdini';
import type { Action } from './$types';

export const POST = async () => {
  const store = await GQL_AddUser.mutate({
    variables: { name: 'JYC', birthDate: new Date('1986-11-07'), delay: 200 },
    fetch
  });

  // todo: wait for https://github.com/sveltejs/kit/discussions/5875 for the full test to work with return data?
  return {
    status: 200,
    body: {
      addUser: store.data?.addUser
    }
  };
};
