import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query Session {
        session
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        Session: store
    }
};
