/** @type {import('houdini').ConfigFile} */
const config = {
	schemaPath: './schema/schema.gql',
	sourceGlob: 'src/**/*.{svelte,gql,graphql}',
	framework: 'kit',
	module: 'esm',
	apiUrl: 'http://localhost:4000/graphql',
	logLevel: 3,
	scalars: {
		DateTime: {
			type: 'Date',
			marshal(val) {
				return val.getTime()
			},
			unmarshal(val) {
				return new Date(val)
			},
		},
	},
}

export default config
