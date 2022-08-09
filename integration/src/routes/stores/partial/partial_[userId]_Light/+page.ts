import { load_Partial_User_Light } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  const variables = { id: event.params.userId };

  return {
    ...(await load_Partial_User_Light({ event, variables }))
  };
}
