import type { PageLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query FragmentDataNullPageQuery @cache(partial: false) {
        city(id: "1") {
            id
            name

            ...CityDetails
        }
    }
`)

export const load: PageLoad = async (event) => {
    await store.fetch({ event })

    return {
        FragmentDataNullPageQuery: store
    }
};
