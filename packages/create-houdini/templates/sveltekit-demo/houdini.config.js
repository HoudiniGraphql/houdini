/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	watchSchema: {
		url: 'env:PUBLIC_GRAPHQL_ENDPOINT'
	},
	plugins: {
		'houdini-svelte': {}
	}
};

export default config;
