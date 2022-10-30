import { PluginFactory } from 'houdini'

import { extract_documents } from './extract'

const HoudiniReactPlugin: PluginFactory = async () => ({
	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	// we need to teach the codegen how to get graphql documents from jsx files
	extract_documents,
})

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 */
	client: string
}
