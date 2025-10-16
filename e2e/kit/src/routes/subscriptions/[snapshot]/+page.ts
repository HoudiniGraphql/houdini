import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query SubscriptionTestUserList {
        user(id: "1", snapshot: "subscription-test") {
            name
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        SubscriptionTestUserList: store
    }
};
