import type { GenerateHookInput } from 'houdini'

import { generate_entries } from './entries'
import { ProjectManifest } from './manifest'
import { generate_renders } from './render'

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
}: GenerateHookInput & { manifest: ProjectManifest }) {
	// use the manifest to generate all of the necessary project files
	await Promise.all([generate_entries({ config, manifest }), generate_renders(config)])
}
