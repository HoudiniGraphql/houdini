/** @type {import('houdini').ConfigFile} */
const config = {
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
		'houdini-svelte': {
			client: './src/client.ts',
		},
	},
}

export default config
