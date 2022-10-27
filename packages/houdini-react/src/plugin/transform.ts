import { ensure_imports, TransformPage } from 'houdini/vite'
import * as recast from 'recast'

const AST = recast.types.builders

type Program = recast.types.namedTypes.Program

// transform any graphql function into something that sends a query
export async function transform_file(page: TransformPage): Promise<{ code: string }> {
	const content = recast.parse(page.content).program

	// we need to make sure that we have access to fetch query
	ensure_imports({
		script: content,
		sourceModule: '$houdini',
		import: ['fetchQuery'],
	})

	// look for an invocation of the graphql function
	recast.visit(content, {
		visitCallExpression(node) {
			// we only care about invocations of the graphql function
			if (node.value.callee.type === 'Identifier' && node.value.callee.name !== 'graphql') {
				return this.traverse(node)
			}

			node.replace(
				AST.objectExpression([
					AST.objectProperty(AST.identifier('name'), AST.stringLiteral('value')),
				])
			)

			// we're done
			return false
		},
	})

	return recast.print(content)
}
