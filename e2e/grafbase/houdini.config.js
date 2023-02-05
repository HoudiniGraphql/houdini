/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	apiUrl: 'https://grafbase-test-main-alecaivazis.grafbase.app/graphql',
	schemaPollHeaders: {
		'x-api-key': 'env:GRAFBASE_TOKEN'
	},
	plugins: {
		'houdini-svelte': {}
	}
};

export default config;
