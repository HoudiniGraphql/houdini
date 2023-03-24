import * as graphql from 'graphql'
import type { Document, Config } from 'houdini'

export type PluginArtifactData = {
	isManualLoad?: boolean
	set_blocking?: boolean
	set_no_blocking?: boolean
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
	let set_no_blocking = false

	graphql.visit(document.document, {
		// look for any field marked with a list
		Directive(node, _, __, ___) {
			// check loadDirective
			if (node.name.value === config.loadDirective) {
				isManualLoad = false
			}

			// look for the operation
			const operations = document.document.definitions.filter(
				({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
			) as graphql.OperationDefinitionNode[]

			const blockingDirective = operations[0].directives?.find(
				(directive) => directive.name.value === config.blockingDirective
			)
			set_blocking = blockingDirective ? true : false

			const no_blockingDirective = operations[0].directives?.find(
				(directive) => directive.name.value === config.no_blockingDirective
			)
			set_no_blocking = no_blockingDirective ? true : false
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
	if (set_no_blocking) {
		toReturn = {
			...toReturn,
			set_no_blocking,
		}
	}

	return toReturn
}
