import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query ListUsers {
        usersConnection(snapshot: "users-list-fragment") @list(name: "UsersList") {
            edges {
                node {
                    name
                    ...UserListItem
                }
            }
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        ListUsers: store
    }
};
