import { plugin } from 'houdini'

import { extract_documents } from './extract'
import { transform_file } from './transform'

const HoudiniReactPlugin = plugin('houdini-react', async () => ({
	order: 'core',

	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// we need to teach the codegen how to get graphql documents from jsx files
	extract_documents,

	// convert the graphql template tags into references to their artifact
	transform_file,
}))

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {}
