import { graphql, load_MutationUpdateFragment } from '$houdini';
import type { PageLoad } from './$types';

export const load: PageLoad = async (event) => {
  const result = await load_MutationUpdateFragment({ event, blocking: true });

  const unsub = result.MutationUpdateFragment.subscribe(() => {});
  unsub();

  return {
    ...result
  };
};

graphql`
  query MutationUpdateFragment {
    mutationUpdateFragmentData {
      ...MutationUpdateFragmentFragment
    }
  }
`;
