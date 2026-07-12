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

	// a query variable resolved from the session at request time instead of being passed by the
	// caller — the session-query-refetch e2e derives its usersList snapshot from the session, so
	// a session update must refire any query that used it
	runtimeScalars: {
		UsersSnapshotFromSession: {
			type: 'String',
			resolve: ({ session }) => session?.snapshot ?? 'session-query-refetch-initial',
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

	// Client-side loading behavior for the delayed-loading e2e route. loadingDelay/minDuration
	// are UI timing (not secrets/routing), so they belong in this client-bundled config. Values
	// are tuned for the test: fast navigations (< 100ms) show nothing, and once shown the
	// loading state is held 600ms.
	router: {
		loadingDelay: 100,
		minDuration: 600,
	},

	// no session/auth config here — the session keys, session endpoint, and GraphQL apiEndpoint
	// are all server-only now (src/server/+config.ts, typed ServerConfigFile). This file is
	// bundled into the client for scalars, so it holds no secrets and no server-owned routing.
}

export default config
