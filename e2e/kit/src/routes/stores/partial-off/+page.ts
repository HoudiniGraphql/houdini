import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query PartialOff @cache(partial: false) {
        user(id: "1", snapshot: "partial-off") {
            id
            birthDate
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        PartialOff: store
    }
};
