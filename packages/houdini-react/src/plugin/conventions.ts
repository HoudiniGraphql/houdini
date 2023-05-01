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

/** Load the page query for the given route from disk */
export function read_pageQuery(base: string) {
	return fs.readFile(path.join(base, '+page.gql'))
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
export function read_layoutQuery(base: string) {
	return fs.readFile(path.join(base, '+layout.gql'))
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

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-react')
}
