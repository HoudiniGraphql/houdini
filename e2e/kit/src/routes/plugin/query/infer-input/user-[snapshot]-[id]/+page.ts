import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query RouteParamsUserQuery($snapshot: String!, $id: ID!) {
        user(id: $id, snapshot: $snapshot) {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        RouteParamsUserQuery: store
    }
};
