import { graphql } from '$houdini';

const store1 = graphql`
    query ListLoadQuery1 {
        user(id: "1", snapshot: "list-load-query") {
            id
        }
    }
`

const store2 = graphql`
    query ListLoadQuery2 {
        user(id: "2", snapshot: "list-load-query") {
            id
        }
    }
`

export const load = async (event) => {
    await store1.fetch({ event })
    await store2.fetch({ event })

    return {
        ListLoadQuery1: store1,
        ListLoadQuery2: store2
    }
};
