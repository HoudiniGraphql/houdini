import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// we need to make sure we have executables for houdini
try {
	// Remove existing bin file (might be a pnpm wrapper script)
	await fs.rm('node_modules/.bin/houdini', { force: true })

	await fs.symlink(
		path.resolve(__dirname, '../../packages/houdini/build/cmd/index.js'),
		'node_modules/.bin/houdini',
		'file'
	)
} catch {}

// make sure its executable
await fs.chmod('node_modules/.bin/houdini', 0o755)

// create symlinks for houdini plugins to point to their built directories
const plugins = [
	{
		name: 'houdini',
		path: path.resolve(__dirname, '../../packages/houdini/build'),
	},
	{
		name: 'houdini-svelte',
		path: path.resolve(__dirname, '../../packages/houdini-svelte/build/houdini-svelte'),
	},
	{
		name: 'houdini-core',
		path: path.resolve(__dirname, '../../packages/houdini-core/build/houdini-core'),
	},
]

for (const plugin of plugins) {
	try {
		// remove existing symlink/directory if it exists
		await fs.rm(`node_modules/${plugin.name}`, { recursive: true, force: true })

		// create symlink to the built plugin directory
		await fs.symlink(plugin.path, `node_modules/${plugin.name}`, 'dir')
	} catch (e) {
		console.warn(`Failed to create symlink for ${plugin.name}:`, e.message)
	}
}

// For packages with platform-specific binaries, we need to ensure platform-specific packages
// are available in their module resolution context
const packagesWithPlatformBinaries = [
	{
		name: 'houdini-core',
		platformPackages: [
			'houdini-core-darwin-arm64',
			'houdini-core-darwin-x64',
			'houdini-core-linux-arm64',
			'houdini-core-linux-x64',
			'houdini-core-win32-arm64',
			'houdini-core-win32-x64',
		],
	},
	{
		name: 'houdini-svelte',
		platformPackages: [
			'houdini-svelte-darwin-arm64',
			'houdini-svelte-darwin-x64',
			'houdini-svelte-linux-arm64',
			'houdini-svelte-linux-x64',
			'houdini-svelte-win32-arm64',
			'houdini-svelte-win32-x64',
		],
	},
]

for (const packageInfo of packagesWithPlatformBinaries) {
	// Create node_modules directory inside the symlinked package
	const packageNodeModules = `node_modules/${packageInfo.name}/node_modules`
	try {
		await fs.mkdir(packageNodeModules, { recursive: true })
	} catch (e) {
		console.warn(`Failed to create ${packageNodeModules}:`, e.message)
	}

	// Create symlinks for platform-specific packages inside the package's node_modules
	for (const platformPackageName of packageInfo.platformPackages) {
		try {
			const sourcePath = path.resolve(
				__dirname,
				`../../packages/${packageInfo.name}/build/${platformPackageName}`
			)
			const targetPath = `${packageNodeModules}/${platformPackageName}`

			// Check if source exists
			try {
				await fs.access(sourcePath)
			} catch {
				continue // Skip if source doesn't exist
			}

			// Remove existing symlink if it exists
			await fs.rm(targetPath, { recursive: true, force: true })

			// Create symlink
			await fs.symlink(sourcePath, targetPath, 'dir')
		} catch (e) {
			console.warn(
				`Failed to create symlink for ${platformPackageName} in ${packageInfo.name}:`,
				e.message
			)
		}
	}
}
