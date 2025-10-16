import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OptionalRouteParamsUserQuery($snapshot: String! = "test", $id: ID! = "1") {
        user(id: $id, snapshot: $snapshot) {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        OptionalRouteParamsUserQuery: store
    }
};
