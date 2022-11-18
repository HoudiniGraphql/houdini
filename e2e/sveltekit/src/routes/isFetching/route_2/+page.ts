import { load_isFetching_route_1 } from '$houdini';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  // Here we have a new but no initial state with isFetching to true!
  return await load_isFetching_route_1({ event });
};
