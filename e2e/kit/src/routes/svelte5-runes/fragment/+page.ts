import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Svelte5UsersList {
        usersConnection(first: 2, snapshot: "svelte-5") @paginate {
            edges {
                node {
                    ...Svelte5UserDetails
                }
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Svelte5UsersList: store
    }
};
