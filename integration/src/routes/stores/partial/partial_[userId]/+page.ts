import { load_Partial_User } from '$houdini';
import { routes } from '$lib/utils/routes';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  if (!event.params.userId) {
    throw redirect(307, routes.Home);
  }

  const variables = { id: event.params.userId };

  return {
    ...(await load_Partial_User({ event, variables }))
  };
};
