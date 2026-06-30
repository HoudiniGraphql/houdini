/// <reference types="houdini-react" />
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
		'houdini-react': {
			devtools: 'dev',
		},
		'./plugins/node-plugin.mjs': {},
	},

	pluginTransport: 'env:HOUDINI_PLUGIN_TRANSPORT',

	// no router/auth config here — the session keys, session endpoint, and GraphQL apiEndpoint are
	// all server-only now (src/server/+config.ts, typed ServerConfigFile). This file is bundled into
	// the client for scalars, so it holds no secrets and no server-owned routing.
}

export default config
