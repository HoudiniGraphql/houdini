// @ts-ignore
/// <references types="houdini-react">
import type { ConfigFile } from 'houdini'

const config: ConfigFile = {
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
		RefetchableEntity: {
			keys: ['id'],
			resolve: {
				queryField: 'refetchableEntity',
				arguments: (entity) => ({ id: entity.id }),
			},
		},
	},

	plugins: {
		'houdini-react': {},
		'./plugins/node-plugin.mjs': {},
	},

	pluginTransport: 'env:HOUDINI_PLUGIN_TRANSPORT',

	router: {
		auth: {
			url: '/auth/token',
			// sessionKeys present → forms automatically carry a signed CSRF token the
			// server verifies on submit (on top of the always-on Origin check)
			sessionKeys: ['supersecret'],
		},
	},
}

export default config
