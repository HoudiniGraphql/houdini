import type { CollectedGraphQLDocument } from 'houdini'
import { pipelineTest } from 'houdini/test'
import { describe, test } from 'vitest'

import { test_config } from '../test'

const table: Row[] = [
	{
		title: 'QueryStore',
		pass: false,
		documents: [
			`
                query Query {
                    version
                }
            `,
		],
	},
	{
		title: 'MutationStore',
		pass: false,
		documents: [
			`
                query Mutation {
                    version
                }
            `,
		],
	},
	{
		title: 'SubscriptionStore',
		pass: false,
		documents: [
			`
                query Subscription {
                    version
                }
            `,
		],
	},
	{
		title: 'FragmentStore',
		pass: false,
		documents: [
			`
                query Fragment {
                    version
                }
            `,
		],
	},
	{
		title: 'BaseStore',
		pass: false,
		documents: [
			`
                query Base {
                    version
                }
            `,
		],
	},
	{
		title: 'Perfect name',
		pass: true,
		documents: [
			`
                query Version {
                    version
                }
            `,
		],
	},
]

type Row =
	| {
			title: string
			pass: true
			documents: string[]
			check?: (docs: CollectedGraphQLDocument[]) => void
	  }
	| {
			title: string
			pass: false
			documents: string[]
			check?: (result: Error | Error[]) => void
	  }

describe('validate checks', async function () {
	// run the tests
	for (const { title, pass, documents, check } of table) {
		test(title, pipelineTest(await test_config(), documents, pass, check))
	}
})
