import * as recast from 'recast'

type Statement = recast.types.namedTypes.Statement
type Program = recast.types.namedTypes.Program
type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type FunctionDeclaration = recast.types.namedTypes.FunctionDeclaration
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration
type Identifier = recast.types.namedTypes.Identifier
type ArrowFunctionExpression = recast.types.namedTypes.ArrowFunctionExpression
type FunctionExpression = recast.types.namedTypes.FunctionExpression
type CallExpression = recast.types.namedTypes.CallExpression

const AST = recast.types.builders

export function find_insert_index(script: Program) {
	let insert_index = script.body.findIndex((statement) => {
		return statement.type !== 'ImportDeclaration'
	})

	// if we didn't find one, make sure we add stuff at the end of the file
	if (insert_index === -1) {
		insert_index = script.body.length
	}

	return insert_index
}

export function find_exported_fn(
	body: Statement[],
	name: string
): {declaration: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression | null | Identifier | CallExpression, export: ExportNamedDeclaration} | null {
	for (const statement of body) {
		if (statement.type !== 'ExportNamedDeclaration') {
			continue
		}
		const exportDeclaration = statement as ExportNamedDeclaration

		// if the exported thing is a function it could be what we're looking for
		if (exportDeclaration.declaration?.type === 'FunctionDeclaration') {
			const value = exportDeclaration.declaration as FunctionDeclaration
			if (value.id?.name === name) {
				return {declaration: exportDeclaration.declaration, export: exportDeclaration}
			}
		}

		// we also need to find exported variables that are functions or arrow functions
		else if (exportDeclaration.declaration?.type === 'VariableDeclaration') {
			const value = exportDeclaration.declaration as VariableDeclaration
			// make sure that the declared value has a matching name
			if (
				value.declarations.length !== 1 ||
				value.declarations[0].type !== 'VariableDeclarator' ||
				value.declarations[0].id.type !== 'Identifier' ||
				value.declarations[0].id.name !== name
			) {
				continue
			}

			// we only care about this exported thing if it's a function or arrow function
			const declaration = value.declarations[0]
			// grab the initialized value
			let { init } = declaration
			if (!init) {
				continue
			}

			// if the value is a satisfies expression, we need to use the actual expression
			if (init.type === 'TSSatisfiesExpression') {
				init = init.expression
			}

			//if the value is a CallExpression the actual FunctionExpression might reside inside the arguments array, see https://github.com/HoudiniGraphql/houdini/issues/1137
			if (
				init.type === 'CallExpression' &&
				init.arguments[0] &&
				(init.arguments[0].type === 'FunctionExpression' ||
					init.arguments[0].type === 'ArrowFunctionExpression')
			) {
				init = init.arguments[0]
			}

			if (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression') {
				return {declaration: init, export: exportDeclaration}
			}
			
			// if the initialized value is the result of a function, or a constant
			if (init.type === 'Identifier' || init.type === 'CallExpression') {
				return {declaration: init, export: exportDeclaration}
			}
		}
		// it wasn't something we care about, move along
		else {
			continue
		}
	}
	const exported = body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			(((expression as ExportNamedDeclaration).declaration?.type === 'FunctionDeclaration' &&
				((expression as ExportNamedDeclaration).declaration as FunctionDeclaration).id
					?.name === name) ||
				((expression as ExportNamedDeclaration).declaration?.type ===
					'VariableDeclaration' &&
					((expression as ExportNamedDeclaration).declaration as VariableDeclaration)
						.declarations.length === 1 &&
					((expression as ExportNamedDeclaration).declaration as VariableDeclaration)
						.declarations[0].type === 'Identifier' &&
					(
						((expression as ExportNamedDeclaration).declaration as VariableDeclaration)
							.declarations[0] as Identifier
					).name === name))
	) as ExportNamedDeclaration
	if (!exported) {
		return null
	}

	return {declaration: exported.declaration as FunctionDeclaration, export: exported} 
}

export function find_exported_id(program: Program, name: string) {
	return program.body.find<ExportNamedDeclaration>(
		(statement): statement is ExportNamedDeclaration =>
			statement.type === 'ExportNamedDeclaration' &&
			statement.declaration?.type === 'VariableDeclaration' &&
			statement.declaration.declarations.length === 1 &&
			statement.declaration.declarations[0].type === 'VariableDeclarator' &&
			statement.declaration.declarations[0].id.type === 'Identifier' &&
			statement.declaration.declarations[0].id.name === name
	)
}
