import { AddUserStore } from '$houdini';
import { get } from 'svelte/store';
// import type { Action } from './$types';

export const POST = async () => {
  const store = new AddUserStore();

  await store.mutate(
    {
      name: 'JYC',
      birthDate: new Date('1986-11-07'),
      delay: 200
    },
    { fetch }
  );

  // todo: wait for https://github.com/sveltejs/kit/discussions/5875 for the full test to work with return data?
  return {
    status: 200,
    body: {
      addUser: get(store)?.data?.addUser ?? null
    }
  };
};
