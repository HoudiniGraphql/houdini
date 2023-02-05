/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
	plugins: {
		'houdini-svelte': {},
		'@grafbase/houdini': {}
	},
	watchSchema: {
		url: 'https://grafbase-test-main-alecaivazis.grafbase.app/graphql',
		headers: {
			'x-api-key': 'env:GRAFBASE_TOKEN'
		}
	}
};

export default config;
