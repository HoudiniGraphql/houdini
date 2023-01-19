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
	const client_plugins = config.plugins
		.filter((plugin) => plugin.client_plugins)
		.reduce((acc, plugin) => {
			let plugins = plugin.client_plugins!
			// if the plugin config is a function then we need to pass the
			// two configs to the factory
			if (typeof plugins === 'function') {
				plugins = plugins(config, config.pluginConfig(plugin.name))
			}

			return [...acc, ...Object.entries(plugins!)]
		}, [] as Record<string, any>[])

	return client_plugins.length > 0
		? `
${client_plugins.map((plugin, i) => importStatement(plugin[0], `plugin${i}`))}

const plugins = [
	${client_plugins
		.map((plugin, i) => {
			const suffix = plugin[1] !== null ? `(${JSON.stringify(plugin[1])})` : ''
			return `plugin${i}${suffix}`
		})
		.join(',\n')}
]

${exportStatement('plugins')}
				`
		: content
}
