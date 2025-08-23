import { houdini_mode } from './constants'
import * as fs from './fs'
import * as path from './path'
import { type Config } from './project'

/** The location of the project's router */
export function router_path(config: Config) {
	return path.join(base_dir(config), 'Router.jsx')
}

/** The location of the page component */
export function page_entry_path(config: Config, id: string, base?: string) {
	return path.join(page_entries_dir(config, base), `${id}.jsx`)
}

export function server_adapter_path(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'render', 'server.js')
}

export function src_dir(config: Config, base: string = config?.root_dir) {
	return path.join(base, 'src')
}

export function local_api_dir(config: Config, base?: string) {
	return path.join(src_dir(config, base), 'api')
}

export function adapter_config_path(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'render', 'config.js')
}

export function vite_render_path(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'render', 'vite.js')
}

export function app_component_path(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'render', 'App.jsx')
}

export function page_unit_path(config: Config, id: string, base?: string) {
	return path.join(page_units_dir(config, base), `${id}.jsx`)
}

export function layout_unit_path(config: Config, id: string, base?: string) {
	return path.join(layout_units_dir(config, base), `${id}.jsx`)
}

export function componentField_unit_path(config: Config, id: string, base?: string) {
	return path.join(units_dir(config, base), 'componentFields', `wrapper_${id}.jsx`)
}

export function fallback_unit_path(
	config: Config,
	which: 'page' | 'layout',
	id: string,
	base?: string
) {
	return path.join(fallbacks_units_dir(config, which, base), `${id}.jsx`)
}

/** Load the page query for the given route from disk */
export async function read_pageQuery(base: string) {
	const target = path.join(base, '+page.gql')
	return [target, await fs.readFile(target)]
}

/** Load the page view for the given route from disk */
export async function read_pageView(base: string) {
	for (const name of ['+page.tsx', '+page.jsx']) {
		let target = path.join(base, name)
		let result = await fs.readFile(target)
		if (result) {
			return [target, result]
		}
	}

	return [null, null]
}

/** Load the layout query for the given route from disk */
export async function read_layoutQuery(base: string) {
	const target = path.join(base, '+layout.gql')
	return [target, await fs.readFile(target)]
}

/** Load the layout view for the given route from disk */
export async function read_layoutView(base: string) {
	for (const name of ['+layout.tsx', '+layout.jsx']) {
		let target = path.join(base, name)
		let result = await fs.readFile(target)
		if (result) {
			return [target, result]
		}
	}

	return [null, null]
}

export function houdini_root(config: Config) {
	return path.join(config.root_dir, config.config_file.runtimeDir ?? '.houdini')
}

export function temp_dir(config: Config, key: string) {
	return path.join(houdini_root(config), 'temp', key)
}

export function routes_dir(config: Config) {
	return path.join(src_dir(config), 'routes')
}

export function router_index_path(config: Config) {
	return path.join(src_dir(config), '+index.jsx')
}

export function is_layout(path: string) {
	return path.endsWith('+layout.tsx') || path.endsWith('+layout.jsx')
}

/** Transforms paths to ids */
export function page_id(path: string) {
	if (path.endsWith('/') && path.length > 1) {
		path = path.substring(0, path.length - 1)
	}
	const special_chars = ['/', ']', '[', '(', ')', '-']
	const mask = '_'

	let copy = ''
	for (const char of path) {
		const match = special_chars.indexOf(char)
		if (match !== -1) {
			copy += mask
		} else {
			copy += char
		}
	}

	return copy
}

export function page_entries_dir(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'entries')
}

function page_units_dir(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'pages')
}

function layout_units_dir(config: Config, base?: string) {
	return path.join(units_dir(config, base), 'layouts')
}

function fallbacks_units_dir(config: Config, which: 'page' | 'layout', base?: string) {
	return path.join(units_dir(config, base), 'fallbacks', which)
}

export function db_path(config: Config) {
	return path.join(houdini_root(config), 'db.sqlite')
}

export function units_dir(config: Config, base: string = base_dir(config)) {
	return path.join(base, 'units')
}

function base_dir(config: Config) {
	return plugin_dir(config, 'houdini-react')
}

function root_plugin_dir(config: Config) {
	return houdini_mode.is_testing ? '../../../' : path.join(houdini_root(config), 'plugins')
}

function plugin_dir(config: Config, name: string) {
	return path.join(root_plugin_dir(config), name)
}

export function serialized_manifest_path(config: Config, base: string = base_dir(config)): string {
	return path.join(base, 'manifest.json')
}
