import esbuild from 'esbuild'
import { replace } from 'esbuild-plugin-replace'
import { glob } from 'glob'
import fs from 'node:fs/promises'
import path from 'node:path'

// the function to build a project assuming the directory layout
export default async function ({ plugin }) {
	await buildPackage({
		packageJSONPath: path.join(process.cwd(), 'package.json'),
		source: path.join(process.cwd(), 'src'),
		outDir: path.join(process.cwd(), 'build'),
		plugin,
	})
}

export async function buildPackage({ packageJSONPath, source, outDir, plugin, onlySource }) {
	// this script will also modify the package.json so that it exports esm modules
	// correctly
	const package_json = JSON.parse(await fs.readFile(packageJSONPath, 'utf-8'))
	package_json.exports = {
		'./package.json': './package.json',
	}
	package_json.typesVersions = { '*': {} }
	delete package_json['main']
	delete package_json['bin']
	delete package_json['types']

	// We also need to pull in the versions of our other packages.
	const packages = {}
	for (const dirname of await fs.readdir(path.dirname(process.cwd()))) {
		packages[dirname] = JSON.parse(
			await fs.readFile(
				path.join(path.dirname(process.cwd()), dirname, 'package.json'),
				'utf-8'
			)
		)
	}

	let options = onlySource ? [source] : []
	if (!onlySource) {
		// look at every directory in the source
		for (const dirname of await fs.readdir(source)) {
			const dir = path.join(source, dirname)

			if (!(await fs.stat(dir)).isDirectory()) {
				continue
			}

			options.push(dir)
		}
	}

	for (const dir of options) {
		const dirname = path.basename(dir)

		// plugins should not be bundled
		if (dirname === 'plugin') {
			await build({ outDir, packages, source: dir, plugin, bundle: false })
			// when there's a plugin directory, that is the main entry point
			package_json.exports['.'] = {
				types: './build/plugin/index.d.ts',
				import: './build/plugin/index.js',
			}
			package_json.types = './build/plugin/index.d.ts'
		}

		// lib defines the main entry point - don't bundle
		else if (dirname === 'lib') {
			await build({ outDir, packages, source: dir, plugin, bundle: false })
			// lib is the main entry point
			package_json.exports[`.`] = {
				types: `./build/${dirname}/index.d.ts`,
				import: `./build/${dirname}/index.js`,
			}
			package_json.types = `./build/${dirname}/index.d.ts`
			package_json.typesVersions['*']['.'] = [`build/${dirname}/index.d.ts`]
		}
		// runtimes can't be bundled
		else if (dirname === 'runtime') {
			await build({ outDir, packages, source: dir, bundle: false, plugin })
		}
		// cmd can now be unbundled since we fixed all import paths
		else if (dirname === 'cmd') {
			package_json.bin = './build/cmd/index.js'
			await build({ outDir, packages, source: dir, plugin, bundle: false, cmd: true })
		}

		// its not a special directory, treat it as a sub module - don't bundle
		else {
			await build({
				packages,
				source: dir,
				outDir,
				plugin,
				bundle: false,
			})

			package_json.exports['./' + dirname] = {
				types: `./build/${dirname}/index.d.ts`,
				import: `./build/${dirname}/index.js`,
			}
			package_json.typesVersions['*'][dirname] = [`build/${dirname}/index.d.ts`]
		}
	}

	// Write to the package root (after processing all directories)
	await fs.writeFile(
		path.join(outDir, '..', 'package.json'),
		JSON.stringify(package_json, null, 4)
	)

	// Create a build-specific package.json with paths relative to build directory
	const buildPackageJson = { ...package_json }

	// Update paths in exports to be relative to build directory
	if (buildPackageJson.exports) {
		for (const [key, value] of Object.entries(buildPackageJson.exports)) {
			if (typeof value === 'object' && value !== null) {
				const updatedValue = {}
				for (const [subKey, subValue] of Object.entries(value)) {
					if (typeof subValue === 'string' && subValue.startsWith('./build/')) {
						updatedValue[subKey] = subValue.replace('./build/', './')
					} else {
						updatedValue[subKey] = subValue
					}
				}
				buildPackageJson.exports[key] = updatedValue
			}
		}
	}

	// Update other build-relative paths
	if (buildPackageJson.bin && buildPackageJson.bin.startsWith('./build/')) {
		buildPackageJson.bin = buildPackageJson.bin.replace('./build/', './')
	}
	if (buildPackageJson.types && buildPackageJson.types.startsWith('./build/')) {
		buildPackageJson.types = buildPackageJson.types.replace('./build/', './')
	}

	// Update typesVersions paths
	if (buildPackageJson.typesVersions) {
		for (const [key, value] of Object.entries(buildPackageJson.typesVersions)) {
			if (typeof value === 'object' && value !== null) {
				for (const [subKey, subValue] of Object.entries(value)) {
					if (Array.isArray(subValue)) {
						buildPackageJson.typesVersions[key][subKey] = subValue.map((path) =>
							path.startsWith('build/') ? path.replace('build/', '') : path
						)
					}
				}
			}
		}
	}

	// Write the build-specific package.json
	await fs.writeFile(path.join(outDir, 'package.json'), JSON.stringify(buildPackageJson, null, 4))
}

// create esm build of the source
export async function build({ outDir, packages, source, bundle = true, plugin, cmd }) {
	// if we aren't bundling, look up the entrypoints once
	const children = bundle
		? []
		: await glob(path.join(source, '**/**/!(*.test)*').replaceAll('\\', '/'), {
				nodir: true,
		  })

	// where we will put everything (no more -esm suffix)
	const target_dir = path.join(outDir, path.basename(source))

	let header = cmd ? '#!/usr/bin/env node\n' : ''

	// compute the appropriate external dependencies based on what we are bundling
	let external = []
	if (bundle) {
		external.push('vite', 'graphql', 'svelte', '@sveltejs/kit', 'HOUDINI_CLIENT_PATH')
	}

	// the esbuild config (ESM only)
	const config = {
		bundle,
		platform: 'node',
		format: 'esm',
		external,
		banner: {
			js: header,
		},
		// Add resolveExtensions to handle directory imports and missing extensions
		resolveExtensions: ['.ts', '.js', '.mjs'],
		// Add mainFields to resolve directory imports to index files
		mainFields: ['module', 'main'],
		plugins: packages
			? [
					replace({
						HOUDINI_PACKAGE_VERSION: packages.houdini.version,
						HOUDINI_SVELTE_PACKAGE_VERSION: packages['houdini-svelte'].version,
					}),
			  ]
			: [],
	}

	// if we are building, turn the source into a single file
	if (bundle) {
		config.outfile = path.join(target_dir, 'index.js')
		// For bundling, we need to point to the index file, not the directory
		// Try different extensions to find the entry file
		const possibleEntries = [
			path.join(source, 'index.ts'),
			path.join(source, 'index.tsx'),
			path.join(source, 'index.js'),
			path.join(source, 'index.jsx'),
		]

		let entryFile = source // fallback to directory if no index file found
		for (const entry of possibleEntries) {
			try {
				await fs.access(entry)
				entryFile = entry
				break
			} catch {
				// File doesn't exist, try next
			}
		}

		config.entryPoints = [entryFile]
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
			JSON.stringify({ type: 'module' }),
			'utf-8'
		)
	} catch (e) {
		console.log(e)
		process.exit(1)
	}
}
