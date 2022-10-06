import { GQL_Hello } from '$houdini';
import type { RequestEvent } from '@sveltejs/kit';

export async function load(event: RequestEvent) {
  const { data } = await GQL_Hello.fetch({ event });

  return { hello: data?.hello };
}
