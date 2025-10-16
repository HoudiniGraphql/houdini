import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query OffsetVariablePaginationQuery($limit: Int!) {
        usersList(limit: $limit, snapshot: "pagination-query-offset-variables") @paginate {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event, variables: { limit: 2 } })

    return {
        OffsetVariablePaginationQuery: store
    }
};
