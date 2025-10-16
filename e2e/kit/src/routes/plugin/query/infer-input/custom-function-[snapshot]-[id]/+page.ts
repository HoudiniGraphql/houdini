import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query CustomFunctionRouteParamsUserQuery($snapshot: String! = "test", $id: ID! = "1") {
        user(id: $id, snapshot: $snapshot) {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event, variables: { id: '2' } })

    return {
        CustomFunctionRouteParamsUserQuery: store
    }
};
