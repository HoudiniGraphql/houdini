import * as recast from 'recast'

type Statement = recast.types.namedTypes.Statement
type Program = recast.types.namedTypes.Program
type ExportNamedDeclaration = recast.types.namedTypes.ExportNamedDeclaration
type FunctionDeclaration = recast.types.namedTypes.FunctionDeclaration

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

export function find_exported_fn(body: Statement[], name: string): FunctionDeclaration | null {
	const exported = body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			(expression as ExportNamedDeclaration).declaration?.type === 'FunctionDeclaration' &&
			((expression as ExportNamedDeclaration).declaration as FunctionDeclaration).id?.name ===
				name
	) as ExportNamedDeclaration
	if (!exported) {
		return null
	}

	return exported.declaration as FunctionDeclaration
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
