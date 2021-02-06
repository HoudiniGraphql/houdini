// externals
import * as graphql from 'graphql'
import { Config } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from '../types'
import applyTransforms from '.'

export function transformTest(
	title: string,
	documents: string[],
	testBody: (docs: CollectedGraphQLDocument[]) => void
) {
	describe('transforms', function () {
		test(title, async function () {
			// the first thing to do is to create the list of collected documents
			const docs: CollectedGraphQLDocument[] = documents.map((documentBody) => {
				// parse the graphql document
				const document = graphql.parse(documentBody)

				// assume we didn't do anything crazy and there's only a single document per case
				const definition = document.definitions[0] as
					| graphql.FragmentDefinitionNode
					| graphql.OperationDefinitionNode

				return {
					name: definition.name?.value || 'NO_NAME',
					document,
				}
			})

			// apply the transforms
			await applyTransforms(
				new Config({
					artifactDirectory: '',
					schema: `type Query { version: Int!}`,
				}),
				docs
			)

			// run the rest of the test
			testBody(docs)
		})
	})
}
