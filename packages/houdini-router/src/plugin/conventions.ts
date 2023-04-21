import { path, fs, Config } from 'houdini'

export function read_pageQuery(base: string) {
	return fs.readFile(path.join(base, '+page.gql'))
}

export function read_pageView(base: string) {
	return fs.readFile(path.join(base, '+page.tsx')) ?? fs.readFile(path.join(base, '+page.jsx'))
}

export function read_layoutQuery(base: string) {
	return fs.readFile(path.join(base, '+layout.gql'))
}

export function read_layoutView(base: string) {
	return (
		fs.readFile(path.join(base, '+layout.tsx')) ?? fs.readFile(path.join(base, '+layout.jsx'))
	)
}

export function normalize_path(path: string) {
	return path.replaceAll(/\//g, '__')
}

function page_bundle_dir(config: Config) {
	return path.join(base_dir(config), 'bundles', 'pages')
}

export function page_bundle_path(config: Config, id: string) {
	return path.join(page_bundle_dir(config), id)
}

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-router')
}
