// external imports
import * as graphql from 'graphql'
import { HoudiniError } from 'houdini-common'
// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup.cjs'
import { CollectedGraphQLDocument } from '../types'

const table: Row[] = [
	{
		title: 'allows non-alias ids',
		pass: true,
		documents: [
			`
                query QueryA {
                    user {
                        id
                    }
                }
            `,
		],
	},
	{
		title: 'fail if id alias is encountered',
		pass: false,
		documents: [
			`
                query QueryA {
                    user {
                        id: firstName
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
