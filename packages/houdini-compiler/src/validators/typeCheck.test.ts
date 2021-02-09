// external imports
import * as graphql from 'graphql'
import { HoudiniError } from 'houdini-common'
// locals
import { pipelineTest } from '../testUtils'
import '../../../../jest.setup'
import { CollectedGraphQLDocument } from '../types'

const table: Row[] = [
	{
		title: 'allows documents that satisfy schema',
		pass: true,
		documents: [
			`
                query QueryA {
                    version
                }
            `,
		],
	},
	{
		title: 'allows documents spread across multiple sources',
		pass: true,
		documents: [
			`
                query QueryA {
                    user {
                        ...FragmentA
                    }
                }
            `,
			`
                fragment FragmentA on User {
                    firstName
                }
            `,
		],
	},
	{
		title: 'unknown types in fragments',
		pass: false,
		documents: [
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
		],
	},
	{
		title: 'unknown fields in queries',
		pass: false,
		documents: [
			`
                query {
                    user {
                        foo
                    }
                }
            `,
		],
	},
	{
		title: 'returns multiple errors',
		pass: false,
		documents: [
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
			`
                fragment FragmentA on Foo {
                    bar
                }
            `,
		],
		check: function (e: HoudiniError[]) {
			expect(e).toHaveLength(2)
		},
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
