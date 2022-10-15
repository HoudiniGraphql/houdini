import { usersListStore, HelloStore } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  const usersList = new usersListStore();
  const Hello = new HelloStore();

  await Promise.all([usersList.fetch({ event }), Hello.fetch({ event })]);

  return {
    test: 'hello',
    usersList,
    Hello
  };
}
