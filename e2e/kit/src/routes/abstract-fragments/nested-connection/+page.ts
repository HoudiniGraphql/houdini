import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query MonkeyListQueryForNesting {
        monkeys {
            pageInfo {
                hasPreviousPage
                hasNextPage
                startCursor
                endCursor
            }
            ...InitialData
            ...MonkeyListProps
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        MonkeyListQueryForNesting: store
    }
};
