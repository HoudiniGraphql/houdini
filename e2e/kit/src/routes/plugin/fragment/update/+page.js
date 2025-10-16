import { graphql } from '$houdini';

const store = graphql(`
    query FragmentUpdateTestQuery($id: ID!) {
        node(id: $id) {
            ... on User {
                ...UserFragmentTestFragment
            }
        }
    }
`)

export const load = async (event) => {
    await store.fetch({ event, variables: { id: 'preprocess-fragment:1' } })

    return {
        FragmentUpdateTestQuery: store
    }
};
