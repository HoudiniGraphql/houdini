import { graphql } from '$houdini';
import { error } from '@sveltejs/kit';

const store = graphql(`
    query PreprocessorTestQueryError($id: ID!) {
        user(id: $id, snapshot: "preprocess-query-variable") {
            name
        }
    }
`)

export const load = async (event) => {
    // Throw error as in original variables function
    error(403, 'test');

    await store.fetch({ event, variables: { id: event.params.id || '1' } })

    return {
        PreprocessorTestQueryError: store
    }
};
