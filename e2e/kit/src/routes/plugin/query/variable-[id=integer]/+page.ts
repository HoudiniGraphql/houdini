import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query PreprocessorTestQueryVars($id: ID!) {
        user(id: $id, snapshot: "preprocess-query-variable") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event, variables: { id: event.params.id || '1' } })

    return {
        PreprocessorTestQueryVars: store
    }
};
