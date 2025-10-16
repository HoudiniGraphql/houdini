import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Svelte5Pagination {
        usersConnection(first: 2, snapshot: "svelte-5-pagination") @paginate {
            edges {
                node {
                    id
                    name
                }
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Svelte5Pagination: store
    }
};
