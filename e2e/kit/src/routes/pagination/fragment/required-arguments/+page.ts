import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UserFragmentRequiredArgsQuery(
        $snapshot: String! = "pagination-fragment-required-arguments"
    ) {
        user(id: "1", snapshot: $snapshot) {
            id
            name

            ...TestFragment @with(snapshot: $snapshot)
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        UserFragmentRequiredArgsQuery: store
    }
};
