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

export async function mkdirp(config: Config) {
	// we need to make the following directories:
	// - a place for entry points to go

	const base = config.pluginDirectory('houdini-router')

	return Promise.all([fs.mkdirp(page_chunk_dir(config))])
}

function page_chunk_dir(config: Config) {
	return path.join(base_dir(config), 'pages')
}

export function page_chunk_path(config: Config, id: string) {
	return path.join(page_chunk_dir(config), id)
}

function base_dir(config: Config) {
	return config.pluginDirectory('houdini-router')
}
