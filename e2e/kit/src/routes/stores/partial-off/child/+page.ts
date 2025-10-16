import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query PartialOffChild @cache(partial: false) {
        user(id: "1", snapshot: "partial-off") {
            id
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        PartialOffChild: store
    }
};
