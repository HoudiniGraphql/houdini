import { ensure_imports } from 'houdini/vite'
import * as recast from 'recast'

const AST = recast.types.builders

type Program = recast.types.namedTypes.Program

export default async function houdiniLoader(source: string): Promise<string> {
	// if there is no $houdini import, ignore it
	if (!source.includes('$houdini')) {
		return source
	}

	// we know the file is something we care about. parse the string
	const parsed = recast.parse(source).program

	console.log(source)
	// print the result and move on
	return recast.print(processQueries(parsed)).code
}

// transform any graphql function into something that sends a query
function processQueries(source: Program): Program {
	// we need to make sure that we have access to fetch query
	ensure_imports({
		script: source,
		sourceModule: '$houdini',
		import: ['fetchQuery'],
	})

	// look for an invocation of the graphql function
	recast.visit(source, {
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

	return source
}
