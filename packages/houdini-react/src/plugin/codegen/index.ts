import * as graphql from 'graphql'
import type { Config, GenerateHookInput, ProjectManifest } from 'houdini'
import { processComponentFieldDirective } from 'houdini'

import { generate_componentFieldBundles } from './componentFields'
import { generate_entries } from './entries'
import { write_manifest } from './manifest'
import { generate_renders } from './render'
import { generate_type_root } from './typeRoot'

/**
 * The router is fundamentally a component that knows how to render
 * a particular component tree for a given url. This is driven by something
 * we call the applications "manifest".
 *
 * In react, the tree of route directories maps to a component hierarchy
 * with suspense boundaries sprinkled when there is a loading directive
 * present on a query.
 */
export default async function routerCodegen({
	config,
	manifest,
	documents,
}: GenerateHookInput & { manifest: ProjectManifest }) {
	// now that we've loaded the manifest we can look up the component field information
	let componentFieldSet: Record<string, ComponentFieldData> = {}

	// go through the documents once, looking for the ones we care about
	for (const document of Object.values(documents)) {
		// we only care about documents with components
		if (!document.artifact?.hasComponents) {
			continue
		}

		// we know the document has components so we need to look at every field
		const typeInfo = new graphql.TypeInfo(config.schema)
		graphql.visit(
			document.document,
			graphql.visitWithTypeInfo(typeInfo, {
				FragmentSpread(node) {
					// if the spread is marked as a component field then
					// add it to the list
					const directive = node.directives?.find(
						(directive) => directive.name.value === config.componentFieldDirective
					)
					if (directive) {
						// find the args we care about
						const { field } = processComponentFieldDirective(directive)
						const type = typeInfo.getParentType()?.name
						if (!field || !type || !config.componentFields[type]?.[field]) {
							return
						}

						const metadata = config.componentFields[type][field]

						// add the component field metadata to the list
						componentFieldSet[metadata.fragment] = {
							type,
							...metadata,
							...processComponentFieldDirective(directive),
						}
					}
				},
			})
		)
	}

	const componentFields = Object.values(componentFieldSet)

	// use the manifest to generate all of the necessary project files
	await Promise.all([
		generate_entries({ componentFields, config, documents, manifest }),
		generate_renders({ componentFields, config, manifest }),
		generate_type_root({ config, manifest }),
		generate_componentFieldBundles({ config, documents }),
		write_manifest({ config, manifest }),
	])
}

export type ComponentFieldData = ReturnType<typeof processComponentFieldDirective> &
	Config['componentFields'][string][string] & {
		type: string
	}
