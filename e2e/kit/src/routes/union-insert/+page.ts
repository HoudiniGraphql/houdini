import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query AorB {
        aOrB @list(name: "All_AorB") {
            __typename
            ... on A {
                id
                a
            }
            ... on B {
                id
                b
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        AorB: store
    }
};
