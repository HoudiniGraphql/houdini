import * as graphql from 'graphql'
import path from 'path'
import { test } from 'vitest'

import { runPipeline } from '../codegen'
import { CollectedGraphQLDocument } from '../lib'
import { ConfigFile } from '../runtime/lib'
import { ArtifactKind } from '../runtime/lib'
import { testConfigFile } from '../runtime/lib/test'
import { Config } from './config'

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		...testConfigFile(config),
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
export { testConfigFile } from '../runtime/lib/test'

export function pipelineTest(
	title: string,
	documents: string[],
	shouldPass: boolean,
	testBody?: ((result: Error | Error[]) => void) | ((docs: CollectedGraphQLDocument[]) => void)
) {
	test(title, async function () {
		// the first thing to do is to create the list of collected documents
		const docs: CollectedGraphQLDocument[] = documents.map(mockCollectedDoc)

		// we need to trap if we didn't fail
		let error: Error[] = []

		try {
			// apply the transforms
			await runPipeline(testConfig(), docs)
		} catch (e) {
			// only bubble the error up if we're supposed to pass the test
			if (shouldPass) {
				throw e
			}
			error = e as Error[]
		}

		// if we shouldn't pass but we did, we failed the test
		if (!shouldPass && error.length === 0) {
			throw 'did not fail test'
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

	const operations = parsed.definitions

	// figure out the document kind
	let kind = ArtifactKind.Fragment
	if (operations.length === 1) {
		// the document kind depends on the artifact
		// query
		if (operations[0].kind === 'OperationDefinition' && operations[0].operation === 'query') {
			kind = ArtifactKind.Query
		}
		// mutation
		else if (
			operations[0].kind === 'OperationDefinition' &&
			operations[0].operation === 'mutation'
		) {
			kind = ArtifactKind.Mutation
		}
		// subscription
		else if (
			operations[0].kind === 'OperationDefinition' &&
			operations[0].operation === 'subscription'
		) {
			kind = ArtifactKind.Subscription
		}
	}

	return {
		name,
		kind,
		document: parsed,
		originalDocument: parsed,
		filename: `${name}.ts`,
		generateArtifact: true,
		generateStore: true,
		originalString: query,
	}
}
