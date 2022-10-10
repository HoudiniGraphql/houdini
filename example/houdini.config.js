/** @type {import('houdini').ConfigFile} */
const config = {
	client: './src/client.ts',
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
	plugins: {
		'houdini-svelte': {},
	},
}

export default config
