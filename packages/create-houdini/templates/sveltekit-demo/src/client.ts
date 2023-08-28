import { PUBLIC_GRAPHQL_ENDPOINT } from '$env/static/public';
import { HoudiniClient } from '$houdini';

export default new HoudiniClient({
	url: PUBLIC_GRAPHQL_ENDPOINT

	// uncomment this to configure the network call (for things like authentication)
	// for more information, please visit here: https://www.houdinigraphql.com/guides/authentication
	// fetchParams({ session }) {
	//     return {
	//         headers: {
	//             Authentication: `Bearer ${session.token}`,
	//         }
	//     }
	// }
});
