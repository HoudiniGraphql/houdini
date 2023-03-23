import { plugin } from 'houdini'

import { extractDocuments } from './extract'
import { transformFile } from './transform'

const HoudiniReactPlugin = plugin('houdini-react', async () => ({
	order: 'core',

	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	includeRuntime: {
		esm: '../runtime-esm',
		commonjs: '../runtime-cjs',
	},

	// we need to teach the codegen how to get graphql documents from jsx files
	extractDocuments,

	// convert the graphql template tags into references to their artifact
	transformFile,

	graphqlTagReturn({ config, document: doc, ensureImport: ensure_import }) {
		// if we're supposed to generate a store then add an overloaded declaration
		if (doc.generateStore) {
			const variableName = `${doc.name}Artifact`

			ensure_import({
				identifier: variableName,
				module: config.artifactImportPath(doc.name).replaceAll('$houdini', '..'),
			})

			// and use the store as the return value
			return variableName
		}
	},
}))

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {}
