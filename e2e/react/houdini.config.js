/// <references types="houdini-react">
/// <references types="houdini-router">
/** @type {import('houdini').ConfigFile} */
const config = {
	watchSchema: {
		url: 'https://houdinigraphql.com/graphql',
	},
	defaultPartial: true,
	scalars: {
		DateTime: {
			type: 'Date',
			// turn the api's response into that type
			unmarshal(val) {
				return new Date(val)
			},
			// turn the value into something the API can use
			marshal(val) {
				return val.getTime()
			},
		},
		File: {
			type: 'File',
		},
	},

	types: {
		RentedBook: {
			keys: ['userId', 'bookId'],
		},
	},

	plugins: {
		'houdini-react': {
			auth: {
				redirect: '/auth/token',
				sessionKeys: ['supersecret'],
			},
		},
	},
}

export default config
