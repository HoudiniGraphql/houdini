import { graphql } from '$houdini';

const store = graphql`
    query SingleLoadQuery {
        user(id: "1", snapshot: "single-load-query") {
            id
        }
    }
`

export const load = async (event) => {
    await store.fetch({ event })

    return {
        SingleLoadQuery: store
    }
};
