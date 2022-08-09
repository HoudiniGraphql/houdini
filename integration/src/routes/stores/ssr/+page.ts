import { load_Hello, load_usersList } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return {
    ...(await load_usersList({ event })),
    ...(await load_Hello({ event }))
  };
}
