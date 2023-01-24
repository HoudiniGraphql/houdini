/** @type {import('houdini').ConfigFile} */
const config = {
	watchSchema: {
		url: 'http://localhost:4000/graphql',
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
	plugins: {
		'houdini-svelte': {},
	},
}

export default config
