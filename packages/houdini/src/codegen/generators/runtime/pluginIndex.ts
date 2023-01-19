import { type Config, fs, path } from '../../../lib'

export async function generatePluginIndex({
	config,
	exportStatement,
}: {
	config: Config
	exportStatement: (module: string) => string
}) {
	// we need to generate an index file
	const indexFile = `${exportStatement('../runtime/client/plugins/index.js')}
`
	// and its typedefs
	const typedefs = `export * from '../runtime/client/plugins'`

	// write both files
	await Promise.all([
		fs.writeFile(path.join(config.pluginRootDirectory, 'index.js'), indexFile),
		fs.writeFile(path.join(config.pluginRootDirectory, 'index.d.ts'), typedefs),
	])
}
