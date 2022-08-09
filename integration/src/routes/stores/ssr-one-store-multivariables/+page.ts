import { load_MultiUser } from '$houdini';
import type { LoadEvent } from '@sveltejs/kit';

export async function load(event: LoadEvent) {
  return {
    store1: (await load_MultiUser({ event, variables: { id: '1' } })).MultiUserStore,
    store2: (await load_MultiUser({ event, variables: { id: '5' } })).MultiUserStore
  };
}
