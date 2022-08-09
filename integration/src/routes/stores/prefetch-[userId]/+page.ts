import { load_User } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  let variables = { id: event.params.userId };

  return {
    ...(await load_User({ event, variables }))
  };
}
