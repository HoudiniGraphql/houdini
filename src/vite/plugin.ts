// externals
import minimatch from 'minimatch'
import path from 'path'
import { Plugin } from 'vite'
import * as recast from 'recast'
// locals
import { formatErrors, getConfig, Script } from '../common'
import { Program } from 'estree'
import generate from '../cmd/generate'
import applyTransforms from './transforms'

const AST = recast.types.builders

export default function HoudiniPlugin(): Plugin {
	return {
		name: 'houdini',

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
			const config = await getConfig()

			try {
				await generate(config)
			} catch (e) {
				formatErrors(e)
				throw new Error('see above')
			}
		},

		async transform(code, filepath) {
			const config = await getConfig()

			const ctx = {
				parse: this.parse,
				addWatchFile: this.addWatchFile,
				config,
				filepath,
			}

			// if the file is not in our configured source path, we need to ignore it
			if (!minimatch(filepath, path.join(process.cwd(), config.sourceGlob))) {
				return
			}

			// run the plugin pipeline
			return applyTransforms(config, ctx, code)
		},
	}
}

export interface TransformContext {
	program: Script
	filepath: string
	addWatchFile: (path: string) => void
}
