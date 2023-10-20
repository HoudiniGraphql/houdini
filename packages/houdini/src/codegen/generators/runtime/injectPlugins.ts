import type { Config } from '../../../lib'

export default async function injectPlugins({
	config,
	content,
	importStatement,
	exportStatement,
}: {
	config: Config
	exportStatement: (as: string) => string
	importStatement: (where: string, as: string) => string
	content: string
}): Promise<string> {
	// get the list of plugins we need to add to the client
	const clientPlugins = config.plugins
		.filter((plugin) => plugin.clientPlugins)
		.reduce((acc, plugin) => {
			let plugins = plugin.clientPlugins!
			// if the plugin config is a function then we need to pass the
			// two configs to the factory
			if (typeof plugins === 'function') {
				plugins = plugins(config, config.pluginConfig(plugin.name))
			}

			return [...acc, ...Object.entries(plugins!)]
		}, [] as Record<string, any>[])

	return clientPlugins.length > 0
		? `
${clientPlugins.map((plugin, i) => importStatement(plugin[0], `plugin${i}`)).join('\n')}

const plugins = [
	${clientPlugins
		.map((plugin, i) => {
			const suffix = `(${JSON.stringify(plugin[1])})`
			return `plugin${i}${suffix}`
		})
		.join(',\n')}
]

${exportStatement('plugins')}
				`
		: content
}
