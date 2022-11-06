import { Config } from 'houdini'

import type { HoudiniVitePluginConfig } from '../../'
import { plugin_config } from '../../kit'

export function store_import(
	cfg: Config,
	which: keyof Required<HoudiniVitePluginConfig>['customStores']
): { statement: string; store_class: string } {
	// look up the import string for the store
	const store_string = plugin_config(cfg).customStores[which]!

	// the last separates the import path from the exported module
	const parts = store_string.split('.')
	const import_path = parts.slice(0, -1).join('.')
	const store_class = parts[parts.length - 1]

	return {
		statement: `import { ${store_class} } from '${import_path}'`,
		store_class,
	}
}
