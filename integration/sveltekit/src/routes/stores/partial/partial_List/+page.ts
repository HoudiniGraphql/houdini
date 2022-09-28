import { load_Partial_List } from '$houdini';
import type { Load } from '@sveltejs/kit';

export const load: Load = async (event) => {
  return {
    ...(await load_Partial_List({ event }))
  };
};
