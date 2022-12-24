import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  if (event.url.pathname.endsWith('query-param')) {
    // fallback to user 2... because why not?
    throw redirect(307, event.url.pathname + '/user-2');
  }
  return {};
};
