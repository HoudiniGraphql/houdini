/** @type {import('houdini').ConfigFile} */
const config = {
	apiUrl: 'http://localhost:4000/graphql',
	plugins: {
		'houdini-svelte': {
			client: './src/client',
			static: true
		}
	}
};

export default config;
