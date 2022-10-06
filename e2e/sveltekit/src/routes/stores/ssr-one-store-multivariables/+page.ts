import { load_MultiUser, loadAll } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return await loadAll({
    store1: load_MultiUser({ event, variables: { id: '1' } }),
    store2: load_MultiUser({ event, variables: { id: '5' } })
  });
}
