// externals
import * as graphql from 'graphql'
import { testConfig } from 'houdini-common'
// locals
import { CollectedGraphQLDocument } from './types'
import { runPipeline } from './compile'
import { HoudiniError } from './error'

export function pipelineTest(
	title: string,
	documents: string[],
	shouldPass: boolean,
	testBody?:
		| ((result: HoudiniError | HoudiniError[]) => void)
		| ((docs: CollectedGraphQLDocument[]) => void)
) {
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
				filename: 'test_file.js',
			}
		})

		// we need to trap if we didn't fail
		let error = null

		try {
			// apply the transforms
			await runPipeline(testConfig(), docs)
		} catch (e) {
			// only bubble the error up if we're supposed to pass the test
			if (shouldPass) {
				throw e
			}
			error = e
		}

		// if we shouldn't pass but we did, we failed the test
		if (!shouldPass && !error) {
			fail('did not fail test')
			return
		}

		// run the rest of the test
		if (testBody) {
			process.stdout.write('invoking check')
			// invoke the test body with the error instead of the documents
			testBody(shouldPass ? docs : error)
		}
	})
}
