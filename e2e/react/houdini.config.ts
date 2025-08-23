// @ts-ignore
/// <references types="houdini-react">
import type { ConfigFile } from 'houdini'

const config: ConfigFile = {
	runtimeDir: '.houdini',
	include: ['src/{components,routes}/**/*.{ts,tsx,gql}'],
	defaultPartial: true,
	scalars: {
		DateTime: {
			type: 'Date',
			unmarshal(val) {
				return new Date(val)
			},
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

	// plugins: {
	// 	'houdini-react': {},
	// },

	router: {
		auth: {
			redirect: '/auth/token',
			sessionKeys: ['supersecret'],
		},
	},
}

export default config
