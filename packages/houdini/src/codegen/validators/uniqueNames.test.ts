import { test } from 'vitest'

import { CollectedGraphQLDocument } from '../../lib/types'
import { pipelineTest, testConfig } from '../../test'

const table: Row[] = [
	{
		title: 'base case',
		pass: false,
		documents: [
			`
                query QueryA {
                    version
                }
            `,
			`
                query QueryA {
                    version
                }
            `,
		],
	},
	{
		title: 'positive case',
		pass: true,
		documents: [
			`
                query QueryA {
                    version
                }
            `,
			`
                query QueryB {
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

// run the tests
for (const { title, pass, documents, check } of table) {
	// run the pipeline over the documents
	test(title, pipelineTest(testConfig(), documents, pass, check))
}
