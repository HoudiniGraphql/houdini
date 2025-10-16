import type { LayoutLoad } from './$types';
import { graphql } from '$houdini';

export const _houdini_session = true;

const store = graphql(`
    query LayoutSession {
        session
    }
`)

export const load: LayoutLoad = async (event) => {
    await store.fetch({ event })

    return {
        LayoutSession: store
    }
};
