import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query NestedFragmentArgs {
        ...UserSearch @with(name: "Bruce")
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        NestedFragmentArgs: store
    }
};
