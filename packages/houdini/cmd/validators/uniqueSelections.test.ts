// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup'
import { CollectedGraphQLDocument, HoudiniError } from '../types'

const table: Row[] = [
	{
		title: 'top level duplicates',
		pass: false,
		documents: [
			`
                query QueryA {
                    version
                    version
                }
            `,
			`
                query QueryB {
                    user {
                        id
                    }
                    user {
                        firstName
                    }
                }
            `,
		],
	},
	{
		title: 'nested duplicates',
		pass: false,
		documents: [
			`
                query QueryA {
                    user {
                        id
                        id
                    }
                }
            `,
			`
                query QueryB {
                    user {
                        firstName
                        firstName
                    }
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
                    user {
                        id
                        firstName
                    }
                }
            `,
			`
                query QueryB {
                    version
                    user {
                        id
                        firstName
                    }
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
			check?: (result: HoudiniError | HoudiniError[]) => void
	  }

// run the tests
for (const { title, pass, documents, check } of table) {
	// run the pipeline over the documents
	pipelineTest(title, documents, pass, check)
}
