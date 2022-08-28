/** @type {import('houdini').ConfigFile} */
const config = {
	client: './src/client.ts',
	apiUrl: 'http://localhost:4000/graphql',
	schemaPollHeaders: {
		foo: 'bar',
	},
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
