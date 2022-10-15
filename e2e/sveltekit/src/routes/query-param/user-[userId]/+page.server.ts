import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  if (event.url.pathname.endsWith('birth') || event.url.pathname.endsWith('friend')) {
    return {};
  }

  // fallback to a default TAB if not set
  throw redirect(307, event.url.pathname + '/birth');
};
