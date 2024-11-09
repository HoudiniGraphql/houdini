import minimatch from 'minimatch'
import { readFile } from 'node:fs/promises'
import type { Plugin, ViteDevServer } from 'vite'
import { watchAndRun } from 'vite-plugin-watch-and-run'

import generate from '../codegen'
import type { PluginConfig } from '../lib'
import { getConfig, formatErrors, path, loadLocalSchema } from '../lib'
import { graphQLDocumentsChanged } from './documents'
import houdini_vite from './houdini'
import { watch_local_schema, watch_remote_schema } from './schema'

export * from './ast'
export * from './imports'
export * from './schema'
export * from './houdini'

export default function (opts?: PluginConfig): Plugin[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	// default autoCodeGen is watch
	opts = { ...opts, autoCodeGen: opts?.autoCodeGen ?? 'watch' }

	// a container of a list
	const watchSchemaListref = { list: [] as string[] }

	// file contents to diff when autoCodeGen == smart
	// maps file paths to extracted graphql documents: { document name: content }
	const extractedDocuments: Record<string, Record<string, string>> = {}

	const plugins = [
		houdini_vite(opts),
		watch_remote_schema(opts),
		watch_local_schema(watchSchemaListref),
	]

	const codegen = async (_server: ViteDevServer | undefined, absolutePath: string | null) => {
		// load the config file
		const config = await getConfig(opts)
		if (config.localSchema) {
			// reload the schema
			config.schema = await loadLocalSchema(config)
		}

		// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
		config.pluginMode = true

		if (opts?.autoCodeGen === 'smart' && absolutePath) {
			const fileContents = await readFile(absolutePath).then((buf) => buf.toString('utf8'))
			if (fileContents) {
				const [documentsChanged, documents] = graphQLDocumentsChanged(
					fileContents,
					extractedDocuments[absolutePath] ?? {}
				)

				if (documentsChanged) {
					extractedDocuments[absolutePath] = documents
				} else {
					console.debug(
						`Skipped codegen for ${absolutePath} since graphql documents did not change`
					)
					return
				}
			}
		}

		// generate the runtime
		await generate(config)
	}

	switch (opts.autoCodeGen) {
		case 'startup':
			void codegen(undefined, null)
			break

		case 'watch':
		case 'smart':
			plugins.push(
				// @ts-ignore TODO
				watchAndRun([
					{
						name: 'Houdini',
						async watchFile(filepath: string) {
							// load the config file
							const config = await getConfig(opts)

							// we need to watch some specific files
							if (config.localSchema) {
								const toWatch = watchSchemaListref.list
								if (toWatch.includes(filepath)) {
									// if it's a schema change, let's reload the config
									await getConfig({ ...opts, forceReload: true })
									return true
								}
							} else {
								const schemaPath = path.join(
									path.dirname(config.filepath),
									config.schemaPath!
								)
								if (minimatch(filepath, schemaPath)) {
									// if it's a schema change, let's reload the config
									await getConfig({ ...opts, forceReload: true })
									return true
								}
							}

							return config.includeFile(filepath, { root: process.cwd() })
						},
						run: codegen,
						delay: 100,
						watchKind: ['add', 'change', 'unlink'],
						formatErrors,
					},
				])
			)
			break
	}

	return plugins
}
