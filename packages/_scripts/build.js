import esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import fs from 'fs/promises'
import glob from 'glob-promise'
import path from 'path'

// the relevant directories
const build_dir = path.join(process.cwd(), 'build')
const src_dir = path.join(process.cwd(), 'src')

// the function to build a project assuming the directory layout
export default async function () {
	// other directories can be bundled

	// this script will also modify the package.json so that it exports esm and cjs versions
	// correctly
	const packageJSON = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json')))
	packageJSON.exports = {}
	packageJSON.typesVersions = { '*': {} }
	delete packageJSON['main']
	delete packageJSON['bin']
	delete packageJSON['types']

	// look at every directory in the source
	for (const dirname of await fs.readdir(src_dir)) {
		const dir = path.join(src_dir, dirname)

		if (!(await fs.stat(dir)).isDirectory()) {
			continue
		}

		// plugins get bundled
		if (dirname === 'plugin') {
			await build(dir)
			// when there's a plugin directory, that is the main entry point
			packageJSON.main = './build/plugin-cjs/index.js'
			packageJSON.exports['.'] = {
				import: './build/plugin-esm/index.js',
				require: './build/plugin-cjs/index.js',
			}
			packageJSON.types = './build/plugin/index.d.ts'
		}
		// lib defines the main entry point
		if (dirname === 'lib') {
			await build(dir)
			// when there's a plugin directory, that is the main entry point
			packageJSON.main = `./build/${dirname}-cjs/index.js`
			packageJSON.exports[`.`] = {
				import: `./build/${dirname}-esm/index.js`,
				require: `./build/${dirname}-cjs/index.js`,
			}
			packageJSON.types = './build/plugin/index.d.ts'
		}
		// runtimes can't be bundled
		else if (dirname === 'runtime') {
			await build(dir, false)
		}
		// cmd needs to be bundled and set as the project's bin
		else if (dirname === 'cmd') {
			packageJSON.bin = './build/cmd-esm/index.js'
			await build(dir)
		}

		// its not a special directory, treat it as a sub module
		else {
			await build(dir)
			packageJSON.exports['./' + dirname] = {
				import: `./build/${dirname}-esm/index.js`,
				require: `./build/${dirname}-cjs/index.js`,
			}
			packageJSON.typesVersions['*'][dirname] = [`build/${dirname}/index.d.ts`]
		}

		await fs.writeFile(
			path.join(process.cwd(), 'package.json'),
			JSON.stringify(packageJSON, null, 4)
		)
	}
}

// create esm and cjs builds of the source
async function build(source, bundle = true) {
	// if we aren't bundling, look up the entrypoints once
	const children = bundle
		? []
		: await glob(path.join(source, '**/**/*'), {
				nodir: true,
		  })

	// do the same thing for esm and cjs
	await Promise.all(
		['esm', 'cjs'].map(async (which) => {
			// where we will put everything
			const target_dir = path.join(build_dir, `${path.basename(source)}-${which}`)

			// the esbuild config
			const config = {
				bundle,
				platform: 'node',
				format: which,
				external: bundle ? ['vite', 'HOUDINI_CONFIG_PATH', 'HOUDINI_CLIENT_PATH'] : [],
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

			await fs.writeFile(
				path.join(target_dir, 'package.json'),
				JSON.stringify({ type: which === 'cjs' ? 'commonjs' : 'module' }),
				'utf-8'
			)
		})
	)
}
