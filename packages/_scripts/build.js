import esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import fs from 'fs'
import path from 'path'

// the relevant directories
const build_dir = path.join(process.cwd(), 'build')
const src_dir = path.join(process.cwd(), 'src')
const plugin_dir = path.join(src_dir, 'plugin')
const runtime_dir = path.join(src_dir, 'runtime')

// the function to build a project assuming the directory layout
export default async function () {
	// plugins need to be bundled
	// runtimes need to be transpiled
	// other directories can be bundled

	// bundle the plugin source for commonjs and esm
	if (fs.existsSync(plugin_dir)) {
		await bundle(plugin_dir)
	}
}

// create esm and cjs bundles of the source
async function bundle(source) {
	await Promise.all(
		['esm', 'cjs'].map((which) =>
			esbuild.build({
				entryPoints: [source],
				bundle: true,
				outfile: path.join(build_dir, `${path.basename(source)}-${which}/index.js`),
				plugins: [
					alias({
						houdini: path.resolve(process.cwd(), '..', 'houdini'),
					}),
				],
				platform: 'node',
				external: [
					'os',
					'assert',
					'vite',
					'fs',
					'path',
					'HOUDINI_CONFIG_PATH',
					'HOUDINI_CLIENT_PATH',
				],
			})
		)
	)
}
