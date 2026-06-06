import childProcess from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPackage, copyRuntimeFiles } from './buildNode.js'
import { writePackageJson, sortFiles, cleanWorkspaceDependencies } from './buildUtils.js'

// if a package needs to be published as a go script then we need to :
// - compile the project for every supported os and architecture into a separate directory
// - generate the appropriate package.json file for each os/architecture
//   - the bin field should point to the compiled binary
// - the root package needs an install script that ensures the correct binary is installed for the current os/architecture
// - the package itself could _also_ be a node package (identified by the package directory) in which case the package entry
//   points need to be set up correctly

// Major platforms on arm64 and amd64, more can be added later
const platforms = [
	{ goOS: 'darwin', arch: 'amd64', nodeOS: 'darwin', cpu: 'x64' },
	{ goOS: 'darwin', arch: 'arm64', nodeOS: 'darwin', cpu: 'arm64' },
	{ goOS: 'linux', arch: 'amd64', nodeOS: 'linux', cpu: 'x64' },
	{ goOS: 'linux', arch: 'arm64', nodeOS: 'linux', cpu: 'arm64' },
	{ goOS: 'windows', arch: 'amd64', nodeOS: 'win32', cpu: 'x64' },
	{ goOS: 'windows', arch: 'arm64', nodeOS: 'win32', cpu: 'arm64' },
]

async function execCmd(cmd, args, env) {
	const spawn = childProcess.spawn(cmd, args, {
		env: { ...process.env, ...env },
	})

	spawn.stdout.on('data', (data) => console.log(data.toString()))
	spawn.stderr.on('data', (data) => console.error(data.toString()))

	return new Promise((resolve, reject) => {
		spawn.on('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`))
		)
	})
}

function buildGoModule(goOS, goArch, outputPath, moduleName) {
	const isWasm = goArch === 'wasm'
	// Strip debug info from WASM binaries: they're loaded and compiled in the
	// browser on every plugin spawn, so binary size directly affects startup time.
	const args = ['build', '-o', `${outputPath}/${moduleName}${goOS === 'windows' ? '.exe' : ''}`]
	if (isWasm) args.push('-trimpath', '-ldflags=-s -w')
	return execCmd('go', args, { GOOS: goOS, GOARCH: goArch })
}

export default async function () {
	const cwd = process.cwd()
	const buildDir = path.join(cwd, 'build')

	try {
		await fs.rm(buildDir, { recursive: true })
	} catch (e) {}

	// load the current package.json to grab necessary metadata
	let packageJSON = JSON.parse(await fs.readFile('./package.json'))

	// build WASM (wasip1) into its own package, same pattern as native platform packages
	const wasmModuleName = `${packageJSON.name}-wasm`
	const wasmBinDir = path.join(buildDir, wasmModuleName, 'bin')
	await fs.mkdir(wasmBinDir, { recursive: true })
	await buildGoModule('wasip1', 'wasm', wasmBinDir, `${packageJSON.name}.wasm`)

	// build each platform
	await Promise.all(
		platforms.map(async (platform) => {
			// the module name is a combination of the current package name and the platform
			const moduleName = `${packageJSON.name}-${platform.nodeOS}-${platform.cpu}`

			// put each binary in its own directory
			const outputDir = path.join(buildDir, moduleName)

			// the path to the binary
			const bin = `bin/${packageJSON.name}${platform.goOS === 'windows' ? '.exe' : ''}`

			// compile the go module
			await buildGoModule(
				platform.goOS,
				platform.arch,
				path.join(outputDir, 'bin'),
				packageJSON.name
			)

			// make sure the binary is executable
			if (process.platform !== 'win32') {
				await execCmd('chmod', ['+x', path.join(outputDir, bin)], {})
			}

      // Clean workspace dependencies
      packageJSON = cleanWorkspaceDependencies(packageJSON)

			// next we need to add the package.json file
			await writePackageJson(
				path.join(outputDir, 'package.json'),
				{
					name: moduleName,
					version: packageJSON.version,
					bin,
					os: [platform.nodeOS],
					cpu: [platform.cpu],
					repository: packageJSON.repository,
					license: packageJSON.license,
					author: packageJSON.author,
					description: packageJSON.description,
					keywords: packageJSON.keywords,
					homepage: packageJSON.homepage,
				}
			)
		})
	)

	// write package.json for the WASM package
	await writePackageJson(
		path.join(buildDir, wasmModuleName, 'package.json'),
		{
			name: wasmModuleName,
			version: packageJSON.version,
			bin: `bin/${packageJSON.name}.wasm`,
			repository: packageJSON.repository,
			license: packageJSON.license,
			author: packageJSON.author,
			description: packageJSON.description,
			keywords: packageJSON.keywords,
			homepage: packageJSON.homepage,
		}
	)

	// now we need to create the root package
  try { 
	  await fs.mkdir(path.join(buildDir, packageJSON.name))
  } catch {}

	// resolve workspace dependencies to actual versions
	const resolvedDependencies = { ...packageJSON.dependencies }
	for (const [key, value] of Object.entries(resolvedDependencies || {})) {
		if (value === 'workspace:^') {
			// Read the version from the workspace package
			try {
				const workspacePackagePath = path.join(path.dirname(cwd), key, 'package.json')
				const workspacePackage = JSON.parse(await fs.readFile(workspacePackagePath, 'utf-8'))
				resolvedDependencies[key] = `^${workspacePackage.version}`
			} catch (error) {
				console.warn(`Warning: Could not resolve workspace dependency ${key}:`, error.message)
				// Remove the dependency if we can't resolve it
				delete resolvedDependencies[key]
			}
		}
	}

	// also resolve workspace devDependencies for the main package
	const resolvedDevDependencies = { ...packageJSON.devDependencies }
	for (const [key, value] of Object.entries(resolvedDevDependencies || {})) {
		if (value === 'workspace:^') {
			// For devDependencies, we typically just remove them since they're not needed at runtime
			delete resolvedDevDependencies[key]
		}
	}

	// modify the package.json
	packageJSON = {
		...packageJSON,
		dependencies: resolvedDependencies,
		devDependencies: resolvedDevDependencies,
		optionalDependencies: Object.fromEntries([
			...platforms.map((platform) => [
				`${packageJSON.name}-${platform.nodeOS}-${platform.cpu}`,
				packageJSON.version,
			]),
			[wasmModuleName, packageJSON.version],
		]),
		scripts: {
			...packageJSON.scripts,
			postinstall: 'node postInstall.js',
		},
		bin: `bin/${packageJSON.name}`,
	}

	// create bin directory
	const binDir = path.join(buildDir, packageJSON.name, 'bin')
	await fs.mkdir(binDir, { recursive: true })

	// read the install script and shim
	for (const script of ['postInstall.js', 'shim.cjs']) {
		let scriptPath
		if (script === 'shim.cjs') {
			// Put the shim in bin/ directory with the package name
			scriptPath = path.join(binDir, packageJSON.name)
		} else {
			// Put other scripts in the root
			scriptPath = path.join(buildDir, packageJSON.name, script)
		}

		let scriptContents = await fs.readFile(
			path.join(path.dirname(fileURLToPath(import.meta.url)), 'templates', script),
			'utf8'
		)
		// apply the package specifics to the install script template
		scriptContents = scriptContents
			.replace(/my-package/g, packageJSON.name)
			.replace(/my-binary/g, packageJSON.name)
			.replace(/package-version/g, packageJSON.version)
			.replace(/MY_PACKAGE_BINARY_PATH/g, `${packageJSON.name.toUpperCase().replace(/-/g, '_')}_BINARY_PATH`)

		await fs.writeFile(scriptPath, scriptContents, 'utf8')

		if (process.platform !== 'win32') {
			await execCmd('chmod', ['+x', scriptPath], {})
		}
	}

	// write the package.json somewhere that we can use later (the package scripts will modify it)
	const packageJSONPath = path.join(buildDir, packageJSON.name, 'package.json')
	await writePackageJson(packageJSONPath, packageJSON)

	// if there is a package directory then we need to build it and add the necessary entries in our package.json
	const packagePath = path.join(cwd, 'package')
	try {
		await fs.access(packagePath)
		// preserve the bin field before calling buildPackage
		const currentPackageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf-8'))
		const binField = currentPackageJSON.bin

		await buildPackage({
			packageJSONPath,
			source: packagePath,
			outDir: path.join(buildDir, packageJSON.name),
		})

		// restore the bin field after buildPackage (only if it was removed)
		if (binField) {
			const updatedPackageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf-8'))
			if (!updatedPackageJSON.bin) {
				updatedPackageJSON.bin = binField
				await writePackageJson(packageJSONPath, updatedPackageJSON)
			}
		}
	} catch (e) {}

	// if there is a runtime directory then we need to handle that too
	// copy raw .ts files without compilation
	const runtimeSource = path.join(cwd, 'runtime')
	try {
		await fs.access(runtimeSource)
		await copyRuntimeFiles({
			outDir: path.join(buildDir, packageJSON.name),
			source: runtimeSource,
		})
	} catch (e) {}

	// if there is a vite directory then we need to build it and add the necessary entries in our package.json
	const vitePath = path.join(cwd, 'vite')
	try {
		await fs.access(vitePath)
		// preserve the bin field before calling buildPackage
		const currentPackageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf-8'))
		const binField = currentPackageJSON.bin

		await buildPackage({
			packageJSONPath,
			source: vitePath,
			outDir: path.join(buildDir, packageJSON.name),
		})

		// restore the bin field after buildPackage (only if it was removed)
		if (binField) {
			const updatedPackageJSON = JSON.parse(await fs.readFile(packageJSONPath, 'utf-8'))
			if (!updatedPackageJSON.bin) {
				updatedPackageJSON.bin = binField
				await writePackageJson(packageJSONPath, updatedPackageJSON)
			}
		}
	} catch (e) {}

	// Finally, update the files field with all files that actually exist in the package directory
	const finalPackageJSONPath = path.join(buildDir, packageJSON.name, 'package.json')
	const finalPackageJSON = JSON.parse(await fs.readFile(finalPackageJSONPath, 'utf-8'))

	// Compute files dynamically from what exists in the package directory
	finalPackageJSON.files = sortFiles(
		fsSync.readdirSync(path.join(buildDir, packageJSON.name))
			.filter(file => {
				// Exclude package.json since it's automatically included
				if (file === 'package.json') return false

				// Include all other files and directories
				return true
			})
	)

	await writePackageJson(finalPackageJSONPath, finalPackageJSON)
}
