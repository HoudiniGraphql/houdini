import * as graphql from 'graphql'
import type { Document, Config } from 'houdini'

export type PluginArtifactData = { isManualLoad?: boolean }

export function artifactData({
	config,
	document,
}: {
	config: Config
	document: Document
}): PluginArtifactData {
	// put together the type information for the filter for every list
	let isManualLoad = true

	graphql.visit(document.document, {
		// look for any field marked with a list
		Directive(node, _, __, ___) {
			// check loadDirective
			if (node.name.value === config.loadDirective) {
				isManualLoad = false
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
