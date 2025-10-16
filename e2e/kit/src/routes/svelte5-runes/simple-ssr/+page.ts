import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Svelte5SimpleSSR {
        user(id: "1", snapshot: "hello-svelte-5") {
            name
            birthDate
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Svelte5SimpleSSR: store
    }
};
