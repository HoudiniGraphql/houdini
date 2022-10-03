import { HoudiniPluginFactory } from 'houdini'
import minimatch from 'minimatch'
import path from 'path'

import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
import { resolve_relative } from './kit'
import apply_transforms from './transforms'

const HoudiniSveltePlugin: HoudiniPluginFactory = async () => ({
	extensions: ['.svelte'],

	// custom logic to pull a graphql document out of a svelte file
	extract_documents: extract,

	// transform a file's contents. changes here aren't seen by extract_documents
	transform_file: apply_transforms,

	// when we're done generating, we need to write the svelte specific runtime
	generate_end: generate,

	// we need to add the exports to the index files (this one file processes index.js and index.d.ts)
	index_file({ config, content, export_star_from }) {
		const storesDir =
			'./' + path.relative(config.rootDir, config.storesDirectory).split(path.sep).join('/')

		return content + export_star_from({ module: storesDir })
	},

	include(config, filepath) {
		// deal with any relative imports from compiled assets
		filepath = resolve_relative(config, filepath)

		// if the filepath doesn't match the include we're done
		if (!minimatch(filepath, path.join(config.projectRoot, config.include))) {
			return false
		}
	},

	// add custom vite config
	vite: {
		...fs_patch(),
	},
})

export default HoudiniSveltePlugin
