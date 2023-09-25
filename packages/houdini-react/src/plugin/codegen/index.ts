import type { GenerateHookInput, ProjectManifest } from 'houdini'

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
	// use the manifest to generate all of the necessary project files
	await Promise.all([
		generate_entries({ config, documents, manifest }),
		generate_renders({ config, manifest }),
		generate_type_root({ config, manifest }),
		write_manifest({ config, manifest }),
	])
}
