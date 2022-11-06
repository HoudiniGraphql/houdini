import { Config, siteURL as SITE_URL, fs, HoudiniError, path, houdini_mode } from '../../../lib'

export default async function runtimeGenerator(config: Config) {
	// generate the adapter to normalize interactions with the framework
	// update the generated runtime to point to the client
	await Promise.all([
		fs.recursiveCopy(config.runtimeSource, config.runtimeDirectory, {
			// transform the files while we are copying so we don't trigger unnecessary changes
			[path.join(config.runtimeSource, 'lib', 'config.js')]: (content) => {
				// the path to the config file
				const configFilePath = path.join(config.runtimeDirectory, 'lib', 'config.js')
				// the relative path
				const relativePath = path.relative(path.dirname(configFilePath), config.filepath)

				return content.replace('HOUDINI_CONFIG_PATH', relativePath)
			},
			[path.join(config.runtimeSource, 'lib', 'constants.js')]: (content) => {
				return content.replace('SITE_URL', SITE_URL)
			},
		}),
		...config.plugins
			.filter((plugin) => plugin.include_runtime)
			.map((plugin) => generatePluginRuntime(config, plugin)),
	])
}

async function generatePluginRuntime(config: Config, plugin: Config['plugins'][number]) {
	if (houdini_mode.is_testing) {
		return
	}

	// a plugin with a generated runtime has something at <dir>/build/runtime-{esm,cjs}

	// find the location of the plugin
	const source = path.join(
		plugin.directory,
		'build',
		'runtime-' + (config.module === 'esm' ? 'esm' : 'cjs')
	)
	try {
		await fs.stat(source)
	} catch {
		throw new HoudiniError({
			message: name + ' does not have a runtime to generate',
			description: 'please use the houdini-scripts command to bundle your plugin',
		})
	}

	const which = config.module === 'esm' ? 'esm' : 'cjs'

	// copy the runtime
	const pluginDir = config.pluginRuntimeDirectory(plugin.name)
	await fs.mkdirp(pluginDir)
	await fs.recursiveCopy(
		source,
		pluginDir,
		Object.fromEntries(
			Object.entries(plugin.transform_runtime ?? {}).map(([key, value]) => [
				path.join(plugin.directory, 'build', `runtime-${which}`, key),
				(content) => value({ config, content }),
			])
		)
	)
}
