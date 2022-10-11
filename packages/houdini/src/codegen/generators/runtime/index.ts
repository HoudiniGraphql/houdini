import path from 'path'

import { Config, siteURL, CollectedGraphQLDocument, fs, HoudiniError } from '../../../lib'

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// copy the compiled source code to the target directory
	await fs.recursiveCopy(config.runtimeSource, config.runtimeDirectory)

	// generate the adapter to normalize interactions with the framework
	// update the generated runtime to point to the client
	await Promise.all([
		...config.plugins
			.filter((plugin) => plugin.include_runtime)
			.map((plugin) => generatePluginRuntime(config, plugin.name)),
		addConfigImport(config),
		addSiteURL(config),
	])
}

async function generatePluginRuntime(config: Config, name: string) {
	if (process.env.TEST) {
		return
	}

	// a plugin with a generated runtime has something at <dir>/build/runtime-{esm,cjs}

	// find the location of the plugin
	const pluginPath = config.findModule(name)
	const source = path.join(
		pluginPath,
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

	// copy the runtime
	const pluginDir = config.pluginRuntimeDirectory(name)
	await fs.mkdirp(pluginDir)
	await fs.recursiveCopy(source, pluginDir)
}

async function addConfigImport(config: Config) {
	// all we need to do is compute the relative path from the generated config file
	// to the config in the config file and replace HOUDINI_config_PATH with the value

	// the path to the config file
	const configFilePath = path.join(config.runtimeDirectory, 'lib', 'config.js')
	// the relative path
	const relativePath = path
		.relative(path.dirname(configFilePath), config.filepath)
		// Windows management
		.replaceAll('\\', '/')

	// read the file, replace the string, update the file
	const contents = await fs.readFile(configFilePath)
	if (!contents) {
		return
	}

	await fs.writeFile(configFilePath, contents.replace('HOUDINI_CONFIG_PATH', relativePath))
}

async function addSiteURL(config: Config) {
	// all we need to do is replace the string value with the library constant

	// the path to the config file
	const target = path.join(config.runtimeDirectory, 'lib', 'constants.js')

	// read the file, replace the string, update the file
	const contents = await fs.readFile(target)
	if (!contents) {
		return
	}

	await fs.writeFile(target, contents.replace('SITE_URL', siteURL))
}
