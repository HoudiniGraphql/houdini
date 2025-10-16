import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OptimisticUsersList {
        usersList(snapshot: "mutation-opti-list", limit: 15) @list(name: "OptimisticUsersList") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        OptimisticUsersList: store
    }
};
