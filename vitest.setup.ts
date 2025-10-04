import * as graphql from 'graphql'
import * as recast from 'recast'
import { expect } from 'vitest'

expect.addSnapshotSerializer({
	test: (val) =>
		val &&
		typeof val !== 'string' &&
		!Object.values(graphql.Kind).includes(val.kind) &&
		!Object.keys(recast.types.namedTypes).includes(val.type) &&
		!val.document,
	serialize: (val) => {
		return JSON.stringify(val, null, 4)
	},
})
