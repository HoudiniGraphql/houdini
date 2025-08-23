import * as graphql from 'graphql'
import type { Document, Config } from 'houdini'

export type PluginArtifactData = {
	isManualLoad?: boolean
	set_blocking?: boolean
}

export function artifactData({
	config,
	document,
}: {
	config: Config
	document: Document
}): PluginArtifactData {
	// only documents in svelte files require opting into a load
	let isManualLoad = document.filename.endsWith('.svelte')
	let set_blocking: boolean | undefined = undefined

	graphql.visit(document.document, {
		// look for any field marked with a list
		Directive(node, _, __, ___) {
			// check loadDirective
			if (node.name.value === config.loadDirective) {
				isManualLoad = false
			}

			// blocking directives
			if (node.name.value === config.blockingDirective) {
				set_blocking = true
			}
			if (node.name.value === config.blockingDisableDirective) {
				set_blocking = false
			}
		},
	})

	let toReturn = {}
	if (isManualLoad) {
		toReturn = {
			...toReturn,
			isManualLoad,
		}
	}
	if (set_blocking !== undefined) {
		toReturn = {
			...toReturn,
			set_blocking,
		}
	}

	return toReturn
}
