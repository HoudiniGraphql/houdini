/// <references types="houdini-react">
/// <references types="houdini-router">
/** @type {import('houdini').ConfigFile} */
const config = {
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
		Sponsor: {
			keys: ['name'],
		},
	},

	plugins: {
		'houdini-react': {},
	},

	router: {
		auth: {
			redirect: '/auth/token',
			sessionKeys: ['supersecret'],
		},
	},

	features: {
		componentFields: true,
	},
}

export default config
