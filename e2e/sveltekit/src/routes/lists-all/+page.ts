import type { PageLoad } from './$types';
import { load_ListAll } from '$houdini';

export const load: PageLoad = async (event) => {
  const limit = parseInt(event.url.searchParams.get('limit') ?? '1', 10);

  return {
    ...(await load_ListAll({ event, variables: { limit } }))
  };
};
