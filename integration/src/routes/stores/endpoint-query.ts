import { GQL_Hello } from '$houdini';
import type { RequestEvent } from '@sveltejs/kit';

export async function get(event: RequestEvent) {
  const { data } = await GQL_Hello.fetch({ event, fetch });

  return {
    body: {
      data
    }
  };
}
