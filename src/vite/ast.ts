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

export function find_exported_fn(body: Statement[], name: string): ExportNamedDeclaration | null {
	return body.find(
		(expression) =>
			expression.type === 'ExportNamedDeclaration' &&
			(expression as ExportNamedDeclaration).declaration?.type === 'FunctionDeclaration' &&
			((expression as ExportNamedDeclaration).declaration as FunctionDeclaration).id?.name ===
				name
	) as ExportNamedDeclaration
}
