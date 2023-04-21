import { path, plugin, type Plugin } from 'houdini'

import generate from './codegen'
import { load_manifest, type ProjectManifest } from './codegen/manifest'
import { print_router_manifest } from './codegen/router'

let manifest: ProjectManifest

export const hooks: Plugin = async () => ({
	// always make sure our definition of the manifest is up to date before
	// we generate anything
	async beforeGenerate({ config }) {
		manifest = await load_manifest({ config })
	},

	generate(args) {
		return generate({
			...args,
			manifest,
		})
	},

	includeRuntime: {
		esm: '../runtime-esm',
		commonjs: '../runtime-cjs',
	},

	transformRuntime: {
		'client.js': ({ config, exportDefaultStatement, importStatement }) => {
			// all we need to do is import the client from the fixed
			// location and export as the default
			const runtimeFilePath = path.join(
				config.pluginRuntimeDirectory('houdini-router'),
				'config.js'
			)

			// the relative path
			const relativePath = path.relative(
				path.dirname(runtimeFilePath),
				path.join(config.projectRoot, 'src', '+client')
			)

			return `${importStatement(relativePath, 'client')}
${exportDefaultStatement('client')}
`
		},
		'manifest.js': ({ config }) => {
			// we need to generate a manifest for the runtime router
			return print_router_manifest({ config, manifest })
		},
	},
})

export default plugin('houdini-router', hooks)

export type { HoudiniRouterPluginConfig } from './config'
