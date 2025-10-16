import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Svelte5MutationGetData {
        user(id: "1", snapshot: "svelte-5-mutation") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Svelte5MutationGetData: store
    }
};
