import { parse } from '@babel/parser'
import { PluginFactory, path } from 'houdini'
import * as recast from 'recast'

import { plugin_config } from './config'

const HoudiniReactPlugin: PluginFactory = async () => ({
	// add the jsx extensions
	extensions: ['.jsx', '.tsx'],

	transform_runtime: {
		// make sure we can import the client file when we need to
		'network.js': ({ config, content }) => {
			// the path to the network file
			const networkFilePath = path.join(
				config.pluginRuntimeDirectory('houdini-svelte'),
				'network.js'
			)
			// the relative path
			const relativePath = path.relative(
				path.dirname(networkFilePath),
				path.join(config.projectRoot, plugin_config(config).client)
			)

			return content.replace('HOUDINI_CLIENT_PATH', relativePath)
		},
	},

	// we need to teach houdini codegen how to get graphql documents from jsx files
	extract_documents(filepath, content) {
		// the documents  we've found
		const documents: string[] = []

		// parse the content and look for an invocation of the graphql function
		const parsed = parse(content, {
			plugins: ['typescript', 'jsx'],
			sourceType: 'module',
		}).program

		recast.visit(parsed, {
			visitCallExpression(node) {
				const { value } = node
				// we only care about invocations of the graphql function
				if (value.callee.type === 'Identifier' && value.callee.name !== 'graphql') {
					return this.traverse(node)
				}

				// the argument passed to the graphql function should be a string
				// with the document body
				if (value.arguments.length !== 1) {
					return this.traverse(node)
				}
				const argument = value.arguments[0]

				// we need to support template literals as well as strings
				if (argument.type === 'TemplateLiteral' && argument.quasis.length === 1) {
					documents.push(argument.quasis[0].value.raw)
				} else if (argument.type === 'StringLiteral') {
					documents.push(argument.value)
				}

				// we're  done
				return false
			},
		})

		return documents
	},
})

export default HoudiniReactPlugin

export type HoudiniReactPluginConfig = {
	/**
	 * A relative path from your houdini.config.js to the file that exports your client as its default value
	 */
	client: string
}
