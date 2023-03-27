import type { Document } from 'houdini'
import { pipelineTest } from 'houdini/test'
import { describe, expect, test } from 'vitest'

import { test_config } from '../test'

const table: Row[] = [
	{
		title: 'Forbiden name Query',
		pass: false,
		documents: [`query Query { version }`],
		nb_of_fail: 1,
	},
	{
		title: 'Forbiden name Mutation',
		pass: false,
		documents: [`query Mutation { version }`],
		nb_of_fail: 1,
	},
	{
		title: 'Forbiden name Subscription',
		pass: false,
		documents: [`query Subscription { version }`],
		nb_of_fail: 1,
	},
	{
		title: 'Forbiden name Fragment',
		pass: false,
		documents: [`query Fragment { version }`],
		nb_of_fail: 1,
	},
	{
		title: 'Forbiden name Base',
		pass: false,
		documents: [`query Base { version }`],
		nb_of_fail: 1,
	},
	{
		title: 'Perfect name',
		pass: true,
		documents: [`query Version { version }`],
	},
	{
		title: '@blocking @no_blocking on a query',
		pass: false,
		documents: [
			`query TestQuery @blocking @no_blocking {
					version
			}`,
			`query TestQuery2 @blocking @no_blocking {
				version
		}`,
		],
		nb_of_fail: 4,
	},
]

type Row =
	| {
			title: string
			pass: true
			documents: string[]
			check?: (docs: Document[]) => void
			nb_of_fail?: number
	  }
	| {
			title: string
			pass: false
			documents: string[]
			check?: (result: Error | Error[]) => void
			nb_of_fail?: number
	  }

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
								// We want to check that all errors are grouped into 1 throw
								expect(e).toHaveLength(nb_of_fail || 2)
							}
			)
		)
	}
})
