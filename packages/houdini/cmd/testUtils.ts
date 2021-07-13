// externals
import * as graphql from 'graphql'
import { testConfig } from 'houdini-common'
// locals
import { CollectedGraphQLDocument, HoudiniError } from './types'
import { runPipeline } from './generate'

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
		const docs: CollectedGraphQLDocument[] = documents.map(mockCollectedDoc)

		// we need to trap if we didn't fail
		let error: HoudiniError[] = []

		try {
			// apply the transforms
			await runPipeline(testConfig(), docs)
		} catch (e) {
			// only bubble the error up if we're supposed to pass the test
			if (shouldPass) {
				throw e
			}
			error = e as HoudiniError[]
		}

		// if we shouldn't pass but we did, we failed the test
		if (!shouldPass && error.length === 0) {
			fail('did not fail test')
			return
		}

		// run the rest of the test
		if (testBody) {
			// @ts-ignore
			// invoke the test body with the error instead of the documents
			testBody(shouldPass ? docs : error)
		}
	})
}

export function mockCollectedDoc(query: string): CollectedGraphQLDocument {
	const parsed = graphql.parse(query)

	// look at the first definition in the pile for the name
	// @ts-ignore
	const name = parsed.definitions[0].name.value

	return {
		name,
		document: parsed,
		originalDocument: parsed,
		filename: `${name}.ts`,
		generate: true,
	}
}
