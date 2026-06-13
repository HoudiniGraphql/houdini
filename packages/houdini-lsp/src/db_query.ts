import type { Db } from 'houdini/lib'

export type FragmentArg = {
	name: string
	type: string
}

export type FieldInfo = {
	name: string
	type: string
	type_modifiers: string | null
	description: string | null
}

export type DefinitionLocation = {
	filepath: string
	line: number
	column: number
}

// Arguments declared by a fragment via @arguments — used for @with completions.
export function fragment_arguments(db: Db, fragmentName: string): FragmentArg[] {
	return db.all<{ arg_name: string; type_raw: string | null }>(`
		SELECT dda.name AS arg_name, type_av.raw AS type_raw
		FROM document_directives dd
		JOIN documents doc ON doc.id = dd.document
		JOIN document_directive_arguments dda ON dda.parent = dd.id
		JOIN argument_values av ON av.id = dda.value
		LEFT JOIN argument_value_children avc ON avc.parent = av.id AND avc.name = 'type'
		LEFT JOIN argument_values type_av ON type_av.id = avc.value
		WHERE doc.name = ? AND dd.directive = 'arguments'
	`, [fragmentName]).map((r) => ({
		name: r.arg_name,
		type: r.type_raw?.replace(/^"|"$/g, '') ?? 'String',
	}))
}

// Fields on a fragment's type condition — used for @when/@when_not completions.
export function fragment_type_fields(db: Db, fragmentName: string): FieldInfo[] {
	const doc = db.get<{ type_condition: string | null }>(
		`SELECT type_condition FROM documents WHERE name = ? AND kind = 'fragment' LIMIT 1`,
		[fragmentName]
	)
	if (!doc?.type_condition) return []

	return db.all<FieldInfo>(
		`SELECT name, type, type_modifiers, description
		 FROM type_fields
		 WHERE parent = ? AND (internal = 0 OR internal IS NULL)`,
		[doc.type_condition]
	)
}

// Source location of a fragment definition — used for go-to-definition.
export function fragment_definition_location(
	db: Db,
	fragmentName: string
): DefinitionLocation | null {
	return (
		db.get<{ filepath: string; line: number; column: number }>(
			`SELECT rd.filepath, rd.offset_line AS line, rd.offset_column AS column
			 FROM documents d
			 JOIN raw_documents rd ON rd.id = d.raw_document
			 WHERE d.name = ? AND d.kind = 'fragment'
			 LIMIT 1`,
			[fragmentName]
		) ?? null
	)
}

// Names of all discovered lists — used for @prepend_to/@append_to completions.
export function list_names(db: Db): string[] {
	return db
		.all<{ name: string }>(`SELECT name FROM discovered_lists WHERE name IS NOT NULL`)
		.map((r) => r.name)
}
