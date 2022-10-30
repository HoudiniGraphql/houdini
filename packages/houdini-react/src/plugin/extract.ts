import { parse } from '@babel/parser'
import * as recast from 'recast'

export function extract_documents(filepath: string, content: string) {
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
			if (value.callee.type === 'Identifier' && value.callee.name !== 'query') {
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

			// we're done
			return false
		},
	})

	return documents
}
