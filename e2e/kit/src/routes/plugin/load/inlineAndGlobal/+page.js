import { graphql, HelloStore } from '$houdini';

const store2 = graphql`
    query InlineAndGlobalLoadQuery2 {
        user(id: "2", snapshot: "inline-and-global-load") {
            id
        }
    }
`

export const load = async (event) => {
    const helloStore = new HelloStore()

    await helloStore.fetch({ event })
    await store2.fetch({ event })

    return {
        Hello: helloStore,
        InlineAndGlobalLoadQuery2: store2
    }
};
