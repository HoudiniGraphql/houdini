import type { Row } from 'houdini/test'
import { pipelineTest } from 'houdini/test'
import { describe, expect, test } from 'vitest'

import { test_config } from '../test'

const table: Row[] = [
	{
		title: 'Forbiden names Query/Mutation/Subscription/Fragment/Base',
		pass: false,
		documents: [
			`query Mutation { version }`,
			`query Query { version }`,
			`query Subscription { version }`,
			`query Fragment { version }`,
			`query Base { version }`,
		],
		nb_of_fail: 5,
	},
	{
		title: 'Perfect name',
		pass: true,
		documents: [`query Version { version }`],
	},
	{
		title: '@blocking @blocking_disable on a query',
		pass: false,
		documents: [
			`query TestQuery @blocking @blocking_disable {
					version
			}`,
			`query TestQuery2 @blocking @blocking_disable {
				version
		}`,
		],
		nb_of_fail: 4,
	},
]

describe('validate checks', async function () {
	// run the tests
	for (const { title, pass, documents, check, nb_of_fail } of table) {
		test(
			title,
			pipelineTest(
				await test_config(),
				documents,
				pass,
				pass
					? undefined
					: check ||
							function (e: Error | Error[]) {
								const nb_of_fail_to_use = nb_of_fail || 2

								// We should always have at least 2 fail tests, to ensure that the error is caught in bulk
								expect(nb_of_fail_to_use).toBeGreaterThanOrEqual(2)

								// We want to check that all errors are grouped into 1 throw
								// having an array with at least 2 errors
								expect(e).toHaveLength(nb_of_fail_to_use)
							}
			)
		)
	}
})
