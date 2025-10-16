import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query RentedBooks {
        rentedBooks {
            userId
            bookId
            rate
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        RentedBooks: store
    }
};
