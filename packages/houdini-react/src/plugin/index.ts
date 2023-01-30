import { plugin } from 'houdini'

import { extractDocuments } from './extract'
import { transformFile } from './transform'

const HoudiniReactPlugin = plugin('houdini-react', async () => ({
	order: 'core',

	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// we need to teach the codegen how to get graphql documents from jsx files
	extractDocuments,

	// convert the graphql template tags into references to their artifact
	transformFile,
}))

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {}
