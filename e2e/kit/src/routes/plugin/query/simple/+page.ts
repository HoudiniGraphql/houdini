import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query PreprocessorTestQuery1 {
        user(id: "1", snapshot: "preprocess-query-simple") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        PreprocessorTestQuery1: store
    }
};
