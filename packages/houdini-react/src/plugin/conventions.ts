import { path, fs, Config } from 'houdini'

/** The location of the project's router */
export function router_path(config: Config) {
	return path.join(base_dir(config), 'Router.jsx')
}

/** The location of the page component */
export function page_entry_path(config: Config, id: string, base?: string) {
	return path.join(page_entries_dir(config, base), `${id}.jsx`)
}

export function page_unit_path(config: Config, id: string, base?: string) {
	return path.join(page_units_dir(config, base), `${id}.jsx`)
}

export function layout_unit_path(config: Config, id: string, base?: string) {
	return path.join(layout_units_dir(config, base), `${id}.jsx`)
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
export function is_layout(path: string) {
	return path.endsWith('+layout.tsx') || path.endsWith('+layout.jsx')
}

/** Transforms paths to ids */
export function normalize_path(path: string) {
	if (path.endsWith('/') && path.length > 1) {
		path = path.substring(0, path.length - 1)
	}
	const special_chars = ['/', ']', '[']
	const mask = '__'

	let copy = ''
	for (const char of path) {
		if (special_chars.includes(char)) {
			copy += mask
		} else {
			copy += char
		}
	}
	return copy
}

export function page_entries_dir(config: Config, base: string = base_dir(config)) {
	return path.join(base, 'entries')
}

function page_units_dir(config: Config, base: string = base_dir(config)) {
	return path.join(base, 'units', 'pages')
}

function layout_units_dir(config: Config, base: string = base_dir(config)) {
	return path.join(base, 'units', 'layouts')
}

function fallbacks_units_dir(
	config: Config,
	which: 'page' | 'layout',
	base: string = base_dir(config)
) {
	return path.join(base, 'units', 'fallbacks', which)
}

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-react')
}
