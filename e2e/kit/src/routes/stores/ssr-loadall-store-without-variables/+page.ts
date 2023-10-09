import { load_Hello, loadAll } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return await loadAll(load_Hello({ event }));
}
