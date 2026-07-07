import { type Adapter, fs, path } from 'houdini'
import { readdirSync } from 'node:fs'
import nodePath from 'node:path'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ outDir, adapterPath, config }) => {
	// read the contents of the app file
	let serverContents = (await fs.readFile(
		fileURLToPath(new URL('./app.js', import.meta.url).href)
	))!

	// make sure that the adapter module imports from the correct path
	serverContents = serverContents.replaceAll('houdini/adapter', `${adapterPath}.js`)

	// the build copies everything in public/ to the root of the output directory, right next to
	// the server bundle. bake the list of those files into the server so it can serve them
	// without ever exposing a sibling it shouldn't (ssr/, index.js)
	serverContents = serverContents.replaceAll(
		'__HOUDINI_PUBLIC_FILES__',
		JSON.stringify(list_public_files(config.root_dir))
	)

	await fs.writeFile(path.join(outDir, 'index.js'), serverContents!)
}

// walk <root>/public and return its files as url paths ('/robots.txt', '/.well-known/...')
function list_public_files(rootDir: string): string[] {
	const publicDir = nodePath.join(rootDir, 'public')
	try {
		return readdirSync(publicDir, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) =>
				// parentPath is absolute; reduce to a /-separated url path relative to public/
				(
					'/' + nodePath.relative(publicDir, nodePath.join(entry.parentPath, entry.name))
				).replaceAll(nodePath.sep, '/')
			)
	} catch {
		// no public directory
		return []
	}
}

export default adapter
