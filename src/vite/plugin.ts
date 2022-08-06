import minimatch from 'minimatch'
import path from 'path'
import * as recast from 'recast'
import { Plugin } from 'vite'

import generate from '../cmd/generate'
import { Config, formatErrors, getConfig, readFile, Script } from '../common'
import './fsPatch'
import applyTransforms from './transforms'
import { PageScriptInfo } from './transforms/kit'

let config: Config

export default function HoudiniPlugin(configFile?: string): Plugin {
	return {
		name: 'houdini',

		// make sure our resolver runs before vite internal resolver to resolve svelte field correctly
		enforce: 'pre',

		// add watch-and-run to their vite config
		async config(viteConfig, { command }) {
			return {
				server: {
					...viteConfig.server,
					fs: {
						...viteConfig.server?.fs,
						allow: ['.'].concat(viteConfig.server?.fs?.allow || []),
					},
				},
			}
		},

		// when the build starts, we need to make sure to generate
		async buildStart() {
			config = await getConfig({ configFile })

			try {
				await generate(config)
			} catch (e) {
				formatErrors(e)
				throw new Error('see above')
			}
		},

		// transform the user's code
		async transform(code, filepath) {
			// if the file is not in our configured source path, we need to ignore it
			if (!minimatch(filepath, path.join(process.cwd(), config.sourceGlob))) {
				return
			}

			// bundle up the contextual stuff
			const ctx = {
				parse: this.parse,
				addWatchFile: this.addWatchFile,
				config,
				filepath,
			}

			// run the plugin pipeline
			const result = await applyTransforms(config, ctx, code)

			return result
		},

		// resolveId, load, and the fsPatch import are needed to trick vite into thinking that
		// SvelteKit route scripts exist even if they aren't present on the filesystem

		resolveId(id, _, { ssr }) {
			if (!ssr) {
				return null
			}

			// if we are resolving a route script, pretend its always there
			if (config.isRouteScript(id)) {
				return { id }
			}

			return null
		},

		async load(id) {
			// if we are processing a route script, we should always return _something_
			if (config.isRouteScript(id)) {
				return {
					code: (await readFile(id)) || '',
				}
			}

			// do the normal thing
			return null
		},
	}
}

export interface TransformPage {
	config: Config
	script: Script
	filepath: string
	addWatchFile: (path: string) => void
	mock_page_info?: PageScriptInfo
}
