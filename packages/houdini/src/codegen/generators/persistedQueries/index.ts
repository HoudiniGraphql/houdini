//externals
import * as graphql from 'graphql'

// internals
import type { Config, Document } from '../../../lib'
import { fs } from '../../../lib'

// the persist output generator is responsible for generating a queryMap.json
// to the provided path with the `hash` as key and the raw query as value.
export default async function persistOutputGenerator(config: Config, docs: Document[]) {
	if (!config.persistedQueriesPath.endsWith('.json')) {
		throw new Error('Can write Persisted Queries only in a ".json" file.')
	}

	const queryMap = docs.reduce<Record<string, string>>((acc, doc) => {
		const { document, generateArtifact, artifact } = doc
		// if the document is generated, just return early since there is no operation
		if (!generateArtifact) {
			return acc
		}

		// Strip all references to internal directives
		let rawString = graphql.print(
			graphql.visit(document, {
				Directive(node) {
					// if the directive is one of the internal ones, remove it
					if (config.isInternalDirective(node.name.value)) {
						return null
					}
				},
			})
		)

		const operations = document.definitions.filter(
			({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
		) as graphql.OperationDefinitionNode[]

		// if there are operations in the document
		if (operations.length > 0 && operations[0].kind === 'OperationDefinition') {
			// use the hash in the artifact (in case plugins customized the hash logic)
			if (artifact) {
				acc[artifact.hash] = rawString
			}
		}

		return acc
	}, {})

	if (Object.keys(queryMap).length === 0) return

	// Write the queryMap to the provided path
	await fs.writeFile(config.persistedQueriesPath, JSON.stringify(queryMap, null, 4))
}
