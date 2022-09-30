import { HoudiniPlugin } from 'houdini/common'
import path from 'path'

import generate from './codegen'
import extract from './extract'
import fs_patch from './fsPatch'
import apply_transforms from './transforms'

const HoudiniSveltePlugin: HoudiniPlugin = async ({ configFile } = {}) => ({
	extensions: ['.svelte'],

	// custom logic to pull a graphql document out of a svelte file
	extract_documents: extract,

	// transform a file's contents. changes here aren't seen by extract_documents
	transform_file: apply_transforms,

	// when we're done generating, we need to write the svelte specific runtime
	generate_end: generate,

	// we need to add the exports to the index files
	index_file({ config, content, export_star_from }) {
		const storesDir =
			'./' + path.relative(config.rootDir, config.storesDirectory).split(path.sep).join('/')

		return content + export_star_from({ module: storesDir })
	},

	// add custom vite config
	vite: {
		...fs_patch(configFile),
	},
})

export default HoudiniSveltePlugin
