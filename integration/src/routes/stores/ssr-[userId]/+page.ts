import { load_User } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return {
    ...(await load_User({
      event,
      variables: { id: event.params.userId, tmp: false }
    }))
  };
}
