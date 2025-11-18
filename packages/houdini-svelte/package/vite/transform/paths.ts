import type { Config } from 'houdini'
import { path } from 'houdini'

export function route_data_path(config: Config, filename: string) {
	// replace the .svelte with .js
	return resolve_relative(config, filename).replace('.svelte', '.js')
}

export function is_root_layout(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.root_dir, '') ===
		path.sep + path.join('src', 'routes', '+layout.svelte')
	)
}

export function is_root_layout_server(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.root_dir, '').replace('.ts', '.js') ===
		path.sep + path.join('src', 'routes', '+layout.server.js')
	)
}

export function is_root_layout_script(config: Config, filename: string) {
	return (
		resolve_relative(config, filename).replace(config.root_dir, '').replace('.ts', '.js') ===
		path.sep + path.join('src', 'routes', '+layout.js')
	)
}

export function resolve_relative(config: Config, filename: string) {
	// kit generates relative import for our generated files. we need to fix that so that
	// vites importer can find the file.
	const match = filename.match('^((../)+)src/routes')
	if (match) {
		filename = path.join(config.root_dir, filename.substring(match[1].length))
	}

	return filename
}
