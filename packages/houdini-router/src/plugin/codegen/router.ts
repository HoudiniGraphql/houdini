import { Config } from 'houdini'

import { ProjectManifest } from './manifest'

export function print_router_manifest({
	config,
	manifest,
}: {
	config: Config
	manifest: ProjectManifest
}): string {
	// every page in the project manifest needs an entry in the router
	// the entries in the router are described by the RuntimeManifest
	// which is added as part of the runtime transform.

	// we're just going to build up the contents of the file as a
	// string and return it

	return ''
}
