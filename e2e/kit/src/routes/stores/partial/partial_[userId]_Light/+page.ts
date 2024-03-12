import { load_Partial_User_Light } from '$houdini';
import { routes } from '$lib/utils/routes.js';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  if (!event.params.userId) {
    redirect(307, routes.Home);
  }

  const variables = { id: event.params.userId };

  return {
    ...(await load_Partial_User_Light({ event, variables }))
  };
};
