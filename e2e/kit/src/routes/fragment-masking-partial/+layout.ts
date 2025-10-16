import type { LayoutLoad } from './$types';
import { graphql } from '$houdini';

const store = graphql(`
    query LayoutCity {
        city(id: "1") {
            id
            name

            # ...CityDetails
        }
    }
`)

export const load: LayoutLoad = async (event) => {
    await store.fetch({ event })

    return {
        LayoutCity: store
    }
};
