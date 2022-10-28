import graphql from 'graphql'
import { ensureArtifactImport, path } from 'houdini'
import { ensure_imports, TransformPage } from 'houdini/vite'
import * as recast from 'recast'

import { plugin_config } from './config'

const AST = recast.types.builders

// transform any graphql function into something that sends a query
export async function transform_file(page: TransformPage): Promise<{ code: string }> {
	const content = recast.parse(page.content).program

	// we also need access to the client
	const client = ensure_imports({
		script: content,
		sourceModule: path
			.relative(path.dirname(page.filepath), plugin_config(page.config).client)
			.replace(/\.[^/.]+$/, ''),
		import: '__houdini__client',
	}).ids

	// we need to make sure that we have access to fetch query
	const fetch_query = ensure_imports({
		script: content,
		sourceModule: '$houdini',
		import: ['fetchQuery'],
	}).ids[0]

	console.log('before visit')
	// look for an invocation of the graphql function
	recast.visit(content, {
		visitCallExpression(node) {
			// we only care about invocations of the graphql function
			if (node.value.callee.type === 'Identifier' && node.value.callee.name !== 'graphql') {
				return this.traverse(node)
			}

			// the argument passed to the graphql function should be a string
			// with the document body
			if (node.value.arguments.length !== 1) {
				return this.traverse(node)
			}
			const argument = node.value.arguments[0]

			// we need to support template literals as well as strings
			let document = ''
			if (argument.type === 'TemplateLiteral' && argument.quasis.length === 1) {
				document = argument.quasis[0].value.raw
			} else if (argument.type === 'StringLiteral') {
				document = argument.value
			}
			const query_name = page.config.documentName(graphql.parse(document))

			// make sure we have a reference to the artifact
			const artifact = ensureArtifactImport({
				config: page.config,
				artifact: { name: query_name },
				body: content.body,
			})

			node.replace(
				AST.callExpression(fetch_query, [
					AST.objectExpression([
						AST.objectProperty(AST.identifier('client'), client),
						AST.objectProperty(AST.identifier('artifact'), AST.identifier(artifact)),
						AST.objectProperty(AST.identifier('variables'), AST.objectExpression([])),
						AST.objectProperty(
							AST.identifier('context'),
							AST.objectExpression([
								AST.objectProperty(
									AST.identifier('fetch'),
									AST.identifier('fetch')
								),
							])
						),
					]),
				])
			)

			// we're done
			return false
		},
	})

	console.log(recast.print(content))

	return recast.print(content)
}
