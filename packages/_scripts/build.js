import esbuild from 'esbuild'
import { replace } from 'esbuild-plugin-replace'
import glob from 'glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

// the relevant directories
const build_dir = path.join(process.cwd(), 'build')
const src_dir = path.join(process.cwd(), 'src')

// the function to build a project assuming the directory layout
export default async function ({ plugin }) {
	// this script will also modify the package.json so that it exports esm and cjs versions
	// correctly
	const package_json = JSON.parse(
		await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
	)
	package_json.exports = {
		'./package.json': './package.json',
	}
	package_json.typesVersions = { '*': {} }
	delete package_json['main']
	delete package_json['bin']
	delete package_json['types']

	// look at every directory in the source
	for (const dirname of await fs.readdir(src_dir)) {
		const dir = path.join(src_dir, dirname)

		if (!(await fs.stat(dir)).isDirectory()) {
			continue
		}

		// plugins get bundled
		if (dirname === 'plugin') {
			await build({ package_json, source: dir, plugin })
			// when there's a plugin directory, that is the main entry point
			package_json.main = './build/plugin-cjs/index.js'
			package_json.exports['.'] = {
				types: './build/plugin/index.d.ts',
				import: './build/plugin-esm/index.js',
				require: './build/plugin-cjs/index.js',
			}
			package_json.types = './build/plugin/index.d.ts'
		}
		// lib defines the main entry point
		else if (dirname === 'lib') {
			await build({ package_json, source: dir, plugin })
			// when there's a plugin directory, that is the main entry point
			package_json.main = `./build/${dirname}-cjs/index.js`
			package_json.exports[`.`] = {
				types: `./build/${dirname}/index.d.ts`,
				import: `./build/${dirname}-esm/index.js`,
				require: `./build/${dirname}-cjs/index.js`,
			}
			package_json.types = `./build/${dirname}/index.d.ts`
		}
		// runtimes can't be bundled
		else if (dirname === 'runtime') {
			await build({ package_json, source: dir, bundle: false, plugin })
		}
		// cmd needs to be bundled and set as the project's bin
		else if (dirname === 'cmd') {
			package_json.bin = './build/cmd-esm/index.js'
			await build({ package_json, source: dir, plugin, cmd: true })
		}

		// its not a special directory, treat it as a sub module
		else {
			await build({ package_json, source: dir, plugin })
			package_json.exports['./' + dirname] = {
				types: `./build/${dirname}/index.d.ts`,
				import: `./build/${dirname}-esm/index.js`,
				require: `./build/${dirname}-cjs/index.js`,
			}
			package_json.typesVersions['*'][dirname] = [`build/${dirname}/index.d.ts`]
		}

		await fs.writeFile(
			path.join(process.cwd(), 'package.json'),
			JSON.stringify(package_json, null, 4)
		)
	}
}

// create esm and cjs builds of the source
async function build({ package_json, source, bundle = true, plugin, cmd }) {
	// if we aren't bundling, look up the entrypoints once
	const children = bundle
		? []
		: await promisify(glob)(path.join(source, '**/**/!(*.test)*').replaceAll('\\', '/'), {
				nodir: true,
		  })

	// do the same thing for esm and cjs
	await Promise.all(
		['esm', 'cjs'].map(async (which) => {
			// where we will put everything
			const target_dir = path.join(build_dir, `${path.basename(source)}-${which}`)

			let header = cmd ? '#!/usr/bin/env node\n' : ''
			if (bundle) {
				if (plugin) {
					header += `const require = conflict_free(import.meta.url);`
				} else {
					header += `import { createRequire as conflict_free } from 'module'; const require = conflict_free(import.meta.url);`
				}
			}

			// the esbuild config
			const config = {
				bundle,
				platform: 'node',
				format: which,
				external: bundle ? ['vite', 'HOUDINI_CLIENT_PATH'] : [],
				banner: {
					js: header,
				},
				plugins: [
					replace({
						PACKAGE_VERSION: package_json.version,
					}),
				],
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

			try {
				await esbuild.build(config)

				await fs.writeFile(
					path.join(target_dir, 'package.json'),
					JSON.stringify({ type: which === 'cjs' ? 'commonjs' : 'module' }),
					'utf-8'
				)
			} catch (e) {
				console.log(e)
				process.exit(1)
			}
		})
	)
}
