import type { LayoutLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query LayoutTestQuery {
        user(id: "1", snapshot: "preprocess-query-simple") {
            name
        }
    }
`)

export const load: LayoutLoad = async (event) => {
    await store.fetch({ event })

    return {
        LayoutTestQuery: store
    }
};
