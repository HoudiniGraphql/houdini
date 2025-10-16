import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query LoadingStateTestQuery {
        city(id: "1", delay: 2000) @loading {
            id
            name @loading

            ...CityInfoWithLoadingState @loading
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        LoadingStateTestQuery: store
    }
};
