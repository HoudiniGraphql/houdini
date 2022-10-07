import { UserStore } from '$houdini';
import { routes } from '$lib/utils/routes.js';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  if (!event.params.userId) {
    throw redirect(307, routes.Home);
  }

  // instantiate a store using the class so we can see it work somewhere
  const User = new UserStore();
  await User.fetch({ event, variables: { id: event.params.userId, tmp: false } });

  return {
    User
  };
};
