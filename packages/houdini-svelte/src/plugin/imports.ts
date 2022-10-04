import { Config, Script } from 'houdini'
import { ensure_imports } from 'houdini/vite'
import recast from 'recast'

import { store_import_path } from './kit'

type Identifier = recast.types.namedTypes.Identifier

export function store_import({
	config,
	script,
	artifact,
	local,
}: {
	config: Config
	script: Script
	artifact: { name: string }
	local?: string
}): { id: Identifier; added: number } {
	const { ids, added } = ensure_imports({
		config,
		script,
		sourceModule: store_import_path(config, artifact.name),
		import: `GQL_${artifact.name}`,
	})

	return { id: ids, added }
}
