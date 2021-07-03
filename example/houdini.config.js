export default {
	schemaPath: './schema/schema.gql',
	sourceGlob: 'src/**/*.svelte',
	framework: 'kit',
	module: 'esm',
	apiUrl: 'http://localhost:4000/graphql',
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
