import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query PreprocessorTestQueryScalars {
        user(id: "1", snapshot: "preprocess-query-scalars") {
            id
            birthDate
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        PreprocessorTestQueryScalars: store
    }
};
