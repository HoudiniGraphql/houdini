import * as graphql from 'graphql'
import type { Document, Config } from 'houdini'

export type PluginArtifactData = {
	isManualLoad?: boolean
	set_blocking?: boolean
	set_blocking_disable?: boolean
}

export function artifactData({
	config,
	document,
}: {
	config: Config
	document: Document
}): PluginArtifactData {
	// put together the type information for the filter for every list
	let isManualLoad = true
	let set_blocking = false
	let set_blocking_disable = false

	graphql.visit(document.document, {
		// look for any field marked with a list
		Directive(node, _, __, ___) {
			// check loadDirective
			if (node.name.value === config.loadDirective) {
				isManualLoad = false
			}

			// blocking directives
			set_blocking = node.name.value === config.blockingDirective ? true : false
			set_blocking_disable =
				node.name.value === config.blockingDisableDirective ? true : false
		},
	})

	let toReturn = {}
	if (isManualLoad) {
		toReturn = {
			...toReturn,
			isManualLoad,
		}
	}
	if (set_blocking) {
		toReturn = {
			...toReturn,
			set_blocking,
		}
	}
	if (set_blocking_disable) {
		toReturn = {
			...toReturn,
			set_blocking_disable,
		}
	}

	return toReturn
}
