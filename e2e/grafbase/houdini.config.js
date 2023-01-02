/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	apiUrl: 'http://localhost:4000/graphql',
	schemaPollHeaders: {
		'x-api-key': 'env:GRAFBASE_TOKEN'
	},
	plugins: {
		'houdini-svelte': {}
	}
};

export default config;
