import * as graphql from 'graphql'
import { CollectedGraphQLDocument, Config } from 'houdini'

export function artifactGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// put together the type information for the filter for every list
	let isManualLoad = false

	for (const doc of docs) {
		graphql.visit(doc.document, {
			// look for any field marked with a list
			Directive(node, _, __, ___) {
				// check manualLoadDirective
				if (node.name.value === config.manualLoadDirective) {
					isManualLoad = true
				}
			},
		})
	}

	let toReturn = {}
	if (isManualLoad) {
		toReturn = {
			isManualLoad,
		}
	}

	return toReturn
}
