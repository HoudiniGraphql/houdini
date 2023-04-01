import { describe, expect, test } from 'vitest'

import { Row, pipelineTest, testConfig } from '../../test'

const table: Row[] = [
	{
		title: 'base case',
		pass: false,
		documents: [
			`query QueryA {version }`,
			`query QueryA {version }`,
			`query QueryB {version }`,
			`query QueryB {version }`,
		],
	},
	{
		title: 'positive case',
		pass: true,
		documents: [
			`query QueryA {version }`,
			`query QueryB {version }`,
			`query QueryC {version }`,
			`query QueryD {version }`,
		],
	},
]

describe('uniqueNames checks', async function () {
	// run the tests
	for (const { title, pass, documents, check, nb_of_fail } of table) {
		test(
			title,
			pipelineTest(
				testConfig(),
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
