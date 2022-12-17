import {
	Config,
	siteURL as SITE_URL,
	fs,
	HoudiniError,
	path,
	houdini_mode,
	CollectedGraphQLDocument,
} from '../../../lib'

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
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

	// figure out if any of the plugins provide a graphql tag export
	const graphql_tag_return = config.plugins.find(
		(plugin) => plugin.graphql_tag_return
	)?.graphql_tag_return
	if (graphql_tag_return) {
		// build up the mapping of hard coded strings to exports
		const overloaded_returns: Record<string, string> = {}
		for (const doc of docs) {
			const return_value = graphql_tag_return!({
				config,
				doc,
				ensure_import({ identifier, module }) {
					console.log(identifier, module)
				},
			})
			if (return_value) {
				overloaded_returns[doc.originalString] = return_value
			}
		}

		// if we have any overloaded return values then we need to update the index.d.ts of the
		// runtime to return those values
		if (Object.keys(overloaded_returns).length > 0) {
			console.log(overloaded_returns)
		}
	}
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
