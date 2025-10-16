import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query MonkeyListQuery {
        monkeys {
            pageInfo {
                hasPreviousPage
                hasNextPage
                startCursor
                endCursor
            }
            ...AnimalsList
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        MonkeyListQuery: store
    }
};
