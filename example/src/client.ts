import { HoudiniClient } from '$houdini'
import { subscriptionPlugin } from '$houdini/plugins'
import { createClient as createWSClient } from 'graphql-ws'

export default new HoudiniClient({
	url: 'http://localhost:4000/graphql',
	plugins: [
		subscriptionPlugin(() =>
			createWSClient({
				url: 'ws://localhost:4000/graphql',
			})
		),
	],
})
