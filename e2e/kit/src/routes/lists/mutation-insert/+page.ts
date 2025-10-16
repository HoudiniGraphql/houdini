import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query UsersListMutationInsertUsers($someParam: Boolean!) {
        usersConnection(first: 5, snapshot: "users-list-mutation-insert") @list(name: "MyList") {
            edges {
                node {
                    id
                    name
                    testField(someParam: $someParam)
                }
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event, variables: { someParam: true } })

    return {
        UsersListMutationInsertUsers: store
    }
};
