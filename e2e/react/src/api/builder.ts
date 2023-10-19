import SchemaBuilder from '@pothos/core'
import RelayPlugin from '@pothos/plugin-relay'
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects'

import type { User } from './users'

export const builder = new SchemaBuilder<{
	Objects: {
		User: User
	}
}>({
	plugins: [SimpleObjectsPlugin, RelayPlugin],
	relayOptions: {},
})

builder.queryType({})

builder.queryField('hello', (t) =>
	t.string({
		resolve: () => 'Hello World! // From Houdini!',
	})
)
