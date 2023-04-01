import { describe, expect, test } from 'vitest'

import { Row, pipelineTest, testConfig } from '../../test'

const table: Row[] = [
	{
		title: 'allows non-alias ids',
		pass: true,
		documents: [
			`query QueryA {
				user {
					id
				}
			}`,
		],
	},
	{
		title: 'fail if id alias is encountered',
		pass: false,
		documents: [
			`query QueryA {
				user {
					id: firstName
				}
			}`,
			`query QueryB {
				user {
					id: firstName
				}
			}`,
		],
	},
	{
		title: 'check types with multiple ids',
		pass: false,
		documents: [
			`query QueryA {
				ghost {
					name: believers {
						id
					}
					aka: friends {
						name
					}
				}
			}`,
			`query QueryB {
				ghost {
					name: believers {
						id
					}
					aka: friends {
						name
					}
				}
			}`,
		],
		nb_of_fail: 4,
	},
]

describe('type check', function () {
	// run the tests
	for (const { title, pass, documents, check, partial_config, nb_of_fail } of table) {
		test(
			title,
			pipelineTest(
				testConfig(partial_config),
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
