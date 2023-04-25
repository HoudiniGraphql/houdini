import { path, fs, Config } from 'houdini'

/** The location of the directory where we put the files for a page bundle */
export function page_bundle_path(config: Config, id: string, base?: string) {
	return path.join(page_bundle_dir(config, base), id)
}

/** The location of the project's router */
export function router_path(config: Config) {
	return path.join(base_dir(config), 'Router.jsx')
}

/** The location of the page component */
export function page_bundle_component(config: Config, id: string, base?: string) {
	return path.join(page_bundle_path(config, id, base), 'entry.jsx')
}

/** Load the page query for the given route from disk */
export function read_pageQuery(base: string) {
	return fs.readFile(path.join(base, '+page.gql'))
}

/** Load the page view for the given route from disk */
export async function read_pageView(base: string) {
	return (
		(await fs.readFile(path.join(base, '+page.tsx'))) ??
		(await fs.readFile(path.join(base, '+page.jsx')))
	)
}

/** Load the layout query for the given route from disk */
export function read_layoutQuery(base: string) {
	return fs.readFile(path.join(base, '+layout.gql'))
}

/** Load the layout view for the given route from disk */
export async function read_layoutView(base: string) {
	return (
		(await fs.readFile(path.join(base, '+layout.tsx'))) ??
		(await fs.readFile(path.join(base, '+layout.jsx')))
	)
}

/** Transforms paths to ids */
export function normalize_path(path: string) {
	const special_chars = ['/', ']', '[']
	let copy = ''
	for (const char of path) {
		if (special_chars.includes(char)) {
			copy += '__'
		} else {
			copy += char
		}
	}
	return copy
}

export function page_bundle_dir(config: Config, base: string = base_dir(config)) {
	return path.join(base, 'pages')
}

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-react')
}
