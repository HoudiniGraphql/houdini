import { setSession } from '$houdini';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

export const COOKIE_NAME = 'cookie_e2e_houdini_user';

const handleTests: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(COOKIE_NAME);

  // set the session information for this event
  setSession(event, { user: token ? { token } : undefined });

  // pass the event onto the default handle
  return await resolve(event);
};

export const handle = sequence(handleTests);
