import esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import fs from 'fs'
import glob from 'glob-promise'
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
		await build(plugin_dir)
	}

	// transpile the runtime directory (no bundling)
	if (fs.existsSync(runtime_dir)) {
		await build(runtime_dir, false)
	}
}

// create esm and cjs builds of the source
async function build(source, bundle = true) {
	// if we aren't bundling, look up the entrypoints once
	const children = bundle ? [] : await glob(path.join(source, '**/*'))

	// do the same thing for esm and cjs
	await Promise.all(
		['esm', 'cjs'].map(async (which) => {
			// where we will put everything
			const target_dir = path.join(build_dir, `${path.basename(source)}-${which}`)

			// the esbuild config
			const config = {
				bundle,
				plugins: [
					alias({
						houdini: path.resolve(process.cwd(), '..', 'houdini'),
					}),
				],
				platform: 'node',
				external: bundle
					? [
							'os',
							'assert',
							'vite',
							'fs',
							'path',
							'HOUDINI_CONFIG_PATH',
							'HOUDINI_CLIENT_PATH',
					  ]
					: [],
			}

			// if we are building, turn the source into a single file
			if (bundle) {
				config.outfile = path.join(target_dir, 'index.js')
				config.entryPoints = [source]
			}
			// we aren't bundling so we need an entry point of every file to be written to a directory
			else {
				config.entryPoints = children
				config.outdir = target_dir
			}

			await esbuild.build(config)
		})
	)
}
