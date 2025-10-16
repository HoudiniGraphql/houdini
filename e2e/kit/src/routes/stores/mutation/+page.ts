import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OptimisticUserQuery {
        user(id: "1", snapshot: "update-user-mutation") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        OptimisticUserQuery: store
    }
};
