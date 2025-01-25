import * as graphql from 'graphql'
import { expect, test } from 'vitest'

import type { Document } from '../../lib'
import { pipelineTest, testConfig } from '../../test'

test('include fragment definitions', async function () {
	const start = [
		`
			query Foo {
				version
				...A
			}
		`,
		`
			fragment A on User {
				firstName
				...B
			}
		`,
		`
			fragment B on User {
				firstName
			}
		`,
	]

	return await pipelineTest(testConfig(), start, true, function (docs: Document[]) {
		// we only care about the Foo document
		const fooDoc = docs.find((doc) => doc.name === 'Foo')!

		// make sure there are at least three definitions
		expect(fooDoc.document.definitions).toHaveLength(3)

		// make sure that there is one for each fragment
		const fragmentADef = fooDoc.document.definitions.find(
			(definition) =>
				definition.kind === graphql.Kind.FRAGMENT_DEFINITION &&
				definition.name.value === 'A'
		)
		const fragmentBDef = fooDoc.document.definitions.find(
			(definition) =>
				definition.kind === graphql.Kind.FRAGMENT_DEFINITION &&
				definition.name.value === 'B'
		)
		expect(fragmentADef).toBeDefined()
		expect(fragmentBDef).toBeDefined()
	})()
})
