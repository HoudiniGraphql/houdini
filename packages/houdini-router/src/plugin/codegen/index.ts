import type { GenerateHookInput } from 'houdini'

import { generate_bundles } from './bundles'
import { generate_manifest } from './manifest'

// The router is fundamentally a component that knows how to render
// a particular component tree for a given url. This is driven by something
// we call the applications "manifest".
//
// In react, the tree of route directories maps to a component hierarchy
// with suspense boundaries sprinkled when there is a loading directive
// present on a query.
export default async function routerCodegen({ config }: GenerateHookInput) {
	// first generate the manifest
	const manifest = await generate_manifest({ config })

	// use the manifest to generate all of the necessary project files
	await Promise.all([generate_bundles({ config, manifest })])
}