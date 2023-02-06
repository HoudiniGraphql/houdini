import type { Config } from '../../../lib'

export async function injectConfig({
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
	// get the list of modules we need to import to get the final config
	const extraConfigs = config.plugins.reduce((acc, plugin) => {
		if (!plugin.config) {
			return acc
		}

		return [...acc, plugin.config]
	}, [] as string[])

	return extraConfigs.length > 0
		? `
${extraConfigs.map((plugin, i) => importStatement(plugin, `plugin${i}`))}

const plugins = [
	${extraConfigs.map((_, i) => `plugin${i}`).join(',\n')}
]

${exportStatement('plugins')}
				`
		: content
}
