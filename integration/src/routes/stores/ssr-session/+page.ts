import { load_Session } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return {
    ...load_Session({ event })
  };
}
