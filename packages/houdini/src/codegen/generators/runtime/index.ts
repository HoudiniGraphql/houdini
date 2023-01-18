import * as recast from 'recast'

import { exportDefault, importDefaultFrom } from '../../../codegen/utils'
import type { Config, CollectedGraphQLDocument } from '../../../lib'
import {
	siteURL as SITE_URL,
	fs,
	HoudiniError,
	path,
	houdini_mode,
	parseJS,
	ensureImports,
} from '../../../lib'

const AST = recast.types.builders

export default async function runtimeGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	const importStatement =
		config.module === 'commonjs'
			? importDefaultFrom
			: (where: string, as: string) => `import ${as} from '${where}'`

	const exportStatement =
		config.module === 'commonjs' ? exportDefault : (as: string) => `export default ${as}`

	// generate the adapter to normalize interactions with the framework
	// update the generated runtime to point to the client
	await Promise.all([
		fs.recursiveCopy(config.runtimeSource, config.runtimeDirectory, {
			[path.join(config.runtimeSource, 'lib', 'constants.js')]: (content) => {
				return content.replace('SITE_URL', SITE_URL)
			},
			// transform the files while we are copying so we don't trigger unnecessary changes
			[path.join(config.runtimeSource, 'imports', 'config.js')]: (content) => {
				// the path to the config file
				const configFilePath = path.join(config.runtimeDirectory, 'imports', 'config.js')
				// the relative path
				const relativePath = path.relative(path.dirname(configFilePath), config.filepath)

				return `${importStatement(relativePath, 'config')}
${exportStatement('config')}
`
			},
			[path.join(config.runtimeSource, 'client', 'plugins', 'injectedPlugins.js')]: (
				content
			) => {
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
			},
		}),
		...config.plugins
			.filter((plugin) => plugin.include_runtime)
			.map((plugin) => generatePluginRuntime(config, plugin)),
	])

	// we need to find the index of the `export default function graphql` in the index.d.ts of the runtime
	const indexPath = path.join(config.runtimeDirectory, 'index.d.ts')
	const contents = await parseJS((await fs.readFile(indexPath)) || '')

	// figure out if any of the plugins provide a graphql tag export
	const graphql_tag_return = config.plugins.find(
		(plugin) => plugin.graphql_tag_return
	)?.graphql_tag_return
	if (graphql_tag_return && contents) {
		// build up the mapping of hard coded strings to exports
		const overloaded_returns: Record<string, string> = {}
		for (const doc of docs) {
			const return_value = graphql_tag_return!({
				config,
				doc,
				ensure_import({ identifier, module }) {
					ensureImports({
						config,
						body: contents.script.body,
						sourceModule: module,
						import: [identifier],
					})
				},
			})
			if (return_value) {
				overloaded_returns[doc.originalString] = return_value
			}
		}

		// if we have any overloaded return values then we need to update the index.d.ts of the
		// runtime to return those values
		if (Object.keys(overloaded_returns).length > 0) {
			for (const [i, expression] of (contents?.script.body ?? []).entries()) {
				if (
					expression.type !== 'ExportNamedDeclaration' ||
					expression.declaration?.type !== 'TSDeclareFunction' ||
					expression.declaration.id?.name !== 'graphql'
				) {
					continue
				}

				// we need to insert an overloaded definition for every entry we found
				for (const [queryString, returnValue] of Object.entries(overloaded_returns)) {
					// build up the input with the query string as a hard coded value
					const input = AST.identifier('str')
					input.typeAnnotation = AST.tsTypeAnnotation(
						AST.tsLiteralType(AST.stringLiteral(queryString))
					)

					// it should return the right thing
					contents?.script.body.splice(
						i,
						0,
						AST.exportNamedDeclaration(
							AST.tsDeclareFunction(
								AST.identifier('graphql'),
								[input],
								AST.tsTypeAnnotation(
									AST.tsTypeReference(AST.identifier(returnValue))
								)
							)
						)
					)
				}

				// we're done here
				break
			}

			// write the result back to the file
			await fs.writeFile(indexPath, recast.prettyPrint(contents!.script).code)
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
