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
      package_json.exports[`./*`] = {
				types: `./build/${dirname}/*`,
				import: `./build/${dirname}/index.js`,
			}
			package_json.types = `./build/${dirname}/index.d.ts`
			package_json.typesVersions['*']['.'] = [`./build/${dirname}/index.d.ts`]
		}
		// cmd can now be unbundled since we fixed all import paths
		else if (dirname === 'cmd') {
			package_json.bin = './cmd/index.js'
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
			package_json.exports['./' + dirname + "/*"] = {
				types: `./build/${dirname}/*`,
				import: `./build/${dirname}/*`,
			}
			package_json.typesVersions['*'][dirname] = [`./build/${dirname}/index.d.ts`]
		}
	}

	// After processing all directories, scan for subdirectories with index.js files
	// and add explicit exports for them to handle ES module directory resolution
	await addSubdirectoryExports(package_json, outDir)

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

	// Also add subdirectory exports to the build package.json
	await addSubdirectoryExportsForBuild(buildPackageJson, outDir)

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
							path.startsWith('./build/') ? path.replace('./build/', './') : path
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

// copy runtime files as raw .ts/.tsx files without compilation
export async function copyRuntimeFiles({ outDir, source }) {
	// find all .ts and .tsx files in the runtime directory, excluding test files
	const files = await glob(path.join(source, '**/*.ts*').replaceAll('\\', '/'), {
		nodir: true,
		ignore: ['**/*.test.*', '**/test.ts'],
	})

	// where we will put everything
	const target_dir = path.join(outDir, path.basename(source))

	// ensure target directory exists
	await fs.mkdir(target_dir, { recursive: true })

	// copy each file preserving directory structure
	for (const file of files) {
		const relativePath = path.relative(source, file)
		const targetPath = path.join(target_dir, relativePath)

		// ensure target subdirectory exists
		await fs.mkdir(path.dirname(targetPath), { recursive: true })

		// copy the file
		await fs.copyFile(file, targetPath)
	}

	// create a package.json to mark it as ESM
	await fs.writeFile(
		path.join(target_dir, 'package.json'),
		JSON.stringify({ type: 'module' }),
		'utf-8'
	)
}

// Function to scan for subdirectories with index.js files and add explicit exports
async function addSubdirectoryExports(packageJson, outDir) {
	try {
		// Find all index.js files in the build directory
		const indexFiles = await glob(path.join(outDir, '**/index.js').replaceAll('\\', '/'), {
			nodir: true,
		})

		for (const indexFile of indexFiles) {
			// Get the relative path from the build directory
			const relativePath = path.relative(outDir, path.dirname(indexFile))

			// Skip the root index.js (already handled)
			if (!relativePath) continue

			// Convert path separators to forward slashes for export keys
			const exportKey = './' + relativePath.replace(/\\/g, '/')

			// Only add if not already present
			if (!packageJson.exports[exportKey]) {
				packageJson.exports[exportKey] = {
					types: `./build/${relativePath}/index.d.ts`,
					import: `./build/${relativePath}/index.js`,
				}
			}
		}

		// Also add explicit exports for commonly imported files to avoid wildcard issues
		await addCommonFileExports(packageJson, outDir)
	} catch (error) {
		console.warn('Warning: Failed to scan for subdirectory exports:', error.message)
	}
}

// Function to add explicit exports for commonly imported files
async function addCommonFileExports(packageJson, outDir) {
	const commonFiles = ['types.js', 'constants.js', 'config.js']

	for (const dirname of ['runtime', 'lib']) {
		for (const fileName of commonFiles) {
			const filePath = path.join(outDir, dirname, fileName)
			try {
				await fs.access(filePath)
				const baseName = path.basename(fileName, '.js')
				const exportKey = `./${dirname}/${baseName}`

				if (!packageJson.exports[exportKey]) {
					packageJson.exports[exportKey] = {
						types: `./build/${dirname}/${baseName}.d.ts`,
						import: `./build/${dirname}/${baseName}.js`,
					}
				}
			} catch {
				// File doesn't exist, skip
			}
		}
	}
}

// Function to add subdirectory exports for build package.json (with build-relative paths)
async function addSubdirectoryExportsForBuild(packageJson, outDir) {
	try {
		// Find all index.js files in the build directory
		const indexFiles = await glob(path.join(outDir, '**/index.js').replaceAll('\\', '/'), {
			nodir: true,
		})

		for (const indexFile of indexFiles) {
			// Get the relative path from the build directory
			const relativePath = path.relative(outDir, path.dirname(indexFile))

			// Skip the root index.js (already handled)
			if (!relativePath) continue

			// Convert path separators to forward slashes for export keys
			const exportKey = './' + relativePath.replace(/\\/g, '/')

			// Only add if not already present
			if (!packageJson.exports[exportKey]) {
				packageJson.exports[exportKey] = {
					types: `./${relativePath}/index.d.ts`,
					import: `./${relativePath}/index.js`,
				}
			}
		}

		// Also add explicit exports for commonly imported files to avoid wildcard issues
		await addCommonFileExportsForBuild(packageJson, outDir)
	} catch (error) {
		console.warn('Warning: Failed to scan for subdirectory exports for build package.json:', error.message)
	}
}

// Function to add explicit exports for commonly imported files (build version)
async function addCommonFileExportsForBuild(packageJson, outDir) {
	const commonFiles = ['types.js', 'constants.js', 'config.js']

	for (const dirname of ['runtime', 'lib']) {
		for (const fileName of commonFiles) {
			const filePath = path.join(outDir, dirname, fileName)
			try {
				await fs.access(filePath)
				const baseName = path.basename(fileName, '.js')
				const exportKey = `./${dirname}/${baseName}`

				if (!packageJson.exports[exportKey]) {
					packageJson.exports[exportKey] = {
						types: `./${dirname}/${baseName}.d.ts`,
						import: `./${dirname}/${baseName}.js`,
					}
				}
			} catch {
				// File doesn't exist, skip
			}
		}
	}
}
