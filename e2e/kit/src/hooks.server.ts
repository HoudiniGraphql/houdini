import { setSession } from '$houdini';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // set the session information for this event
  setSession(event, { user: { token: '1234-Houdini-Token-5678' } });

  // pass the event onto the default handle
  return await resolve(event);
};
