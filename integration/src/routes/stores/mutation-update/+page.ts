import { load_usersList } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  const variables = { limit: 5 };
  return {
    ...(await load_usersList({ event, variables }))
  };
}
