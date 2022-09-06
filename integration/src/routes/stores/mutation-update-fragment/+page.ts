import { graphql, load_MutationUpdateFragment } from '$houdini';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  return {
    ...(await load_MutationUpdateFragment({ event }))
  };
};

graphql`
  query MutationUpdateFragment {
    mutationUpdateFragmentData {
      ...MutationUpdateFragmentFragment
    }
  }
`;
