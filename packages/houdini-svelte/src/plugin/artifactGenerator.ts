import * as graphql from 'graphql'
import type { CollectedGraphQLDocument, Config } from 'houdini'

export type PluginArtifactData = { isManualLoad?: boolean }

export function artifactGenerator(
	config: Config,
	doc: CollectedGraphQLDocument
): PluginArtifactData {
	// put together the type information for the filter for every list
	let isManualLoad = false

	graphql.visit(doc.document, {
		// look for any field marked with a list
		Directive(node, _, __, ___) {
			// check manualLoadDirective
			if (node.name.value === config.manualLoadDirective) {
				isManualLoad = true
			}
		},
	})

	let toReturn = {}
	if (isManualLoad) {
		toReturn = {
			isManualLoad,
		}
	}

	return toReturn
}
