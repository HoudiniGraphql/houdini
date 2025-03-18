import type { Config } from 'houdini'
import path from 'path'

export function stores_directory_name() {
	return 'stores'
}

// the directory where we put all of the stores
export function stores_directory(pluginRoot: string) {
	return path.join(pluginRoot, stores_directory_name())
}

export function type_route_dir(config: Config) {
	return path.join(config.typeRootDir, 'src', 'routes')
}

// the path that the runtime can use to import a store
export function store_import_path({ config, name }: { config: Config; name: string }): string {
	return `$houdini/plugins/houdini-svelte/${stores_directory_name()}/${name}`
}

export function store_suffix(config: Config) {
	// if config changes, we might have more forbiddenNames to add in the validator
	return 'Store'
}

export function store_name({ config, name }: { config: Config; name: string }) {
	return name + store_suffix(config)
}
