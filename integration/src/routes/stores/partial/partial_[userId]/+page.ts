import { load_Partial_User } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export const load = async (event: LoadEvent) => {
  const variables = { id: event.params.userId };

  return {
    ...(await load_Partial_User({ event, variables }))
  };
};
