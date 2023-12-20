import { load_Bug_UsersList } from '$houdini';
import type { PageLoad } from './$houdini';

export const load: PageLoad = async (event) => {
  return {
    ...(await load_Bug_UsersList({
      event,
      variables: {
        someParam: true
      }
    }))
  };
};
