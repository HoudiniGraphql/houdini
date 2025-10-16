import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Directives {
        user(id: "1", snapshot: "directives") {
            name
        }
        cities @include(if: false) {
            name
        }
        hello @skip(if: true)
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Directives: store
    }
};
