import { path, fs, Config } from 'houdini'

/** The location of the directory where we put the files for a page bundle */
export function page_bundle_path(config: Config, id: string) {
	return path.join(page_bundle_dir(config), id)
}

/** The location of the project's router */
export function router_path(config: Config) {
	return path.join(base_dir(config), 'Router.jsx')
}

/** Load the page query for the given route from disk */
export function read_pageQuery(base: string) {
	return fs.readFile(path.join(base, '+page.gql'))
}

/** Load the page view for the given route from disk */
export function read_pageView(base: string) {
	return fs.readFile(path.join(base, '+page.tsx')) ?? fs.readFile(path.join(base, '+page.jsx'))
}

/** Load the layout query for the given route from disk */
export function read_layoutQuery(base: string) {
	return fs.readFile(path.join(base, '+layout.gql'))
}

/** Load the layout view for the given route from disk */
export function read_layoutView(base: string) {
	return (
		fs.readFile(path.join(base, '+layout.tsx')) ?? fs.readFile(path.join(base, '+layout.jsx'))
	)
}

/** Transforms paths to ids */
export function normalize_path(path: string) {
	return path.replaceAll(/\//g, '__')
}

function page_bundle_dir(config: Config) {
	return path.join(base_dir(config), 'bundles', 'pages')
}

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-router')
}
