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
	// 0-based offset of the raw document within its file (see processFile.go)
	line: number
	column: number
	content: string
}

export type ProjectFragment = {
	name: string
	type_condition: string
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

// Source location of a fragment definition — used for go-to-definition. The offsets
// point at the start of the raw document; content lets the caller find the fragment
// keyword within it.
export function fragment_definition_location(
	db: Db,
	fragmentName: string
): DefinitionLocation | null {
	return (
		db.get<DefinitionLocation>(
			`SELECT rd.filepath, rd.offset_line AS line, rd.offset_column AS column, rd.content
			 FROM documents d
			 JOIN raw_documents rd ON rd.id = d.raw_document
			 WHERE d.name = ? AND d.kind = 'fragment'
			 LIMIT 1`,
			[fragmentName]
		) ?? null
	)
}

// Every fragment a document can spread: user-written fragments (generated = 0)
// plus the pipeline's list operation fragments, which are generated but part of
// the user-facing API.
export function project_fragments(db: Db): ProjectFragment[] {
	return db.all<ProjectFragment>(`
		SELECT DISTINCT d.name, d.type_condition
		FROM documents d
		WHERE d.kind = 'fragment'
		  AND d.name IS NOT NULL
		  AND d.type_condition IS NOT NULL
		  AND (
			d.generated = 0 OR d.generated IS NULL
			OR EXISTS (
				SELECT 1 FROM discovered_lists dl
				WHERE d.name = dl.name || '_insert'
				   OR d.name = dl.name || '_toggle'
				   OR d.name = dl.name || '_remove'
				   OR d.name = dl.name || '_upsert'
				   OR d.name = dl.name || '_update'
			)
		  )
	`)
}

// name + declared type (SDL syntax, eg "Boolean" or "[Int!]!"); type is '' when
// we can't determine it, which limits validation to the name
export type ArgSpec = { name: string; type: string }

// Declared arguments for every spreadable fragment — used to live-validate
// @with(...) without waiting for a save. Fragments without @arguments map to [].
export function all_fragment_arguments(db: Db): Map<string, ArgSpec[]> {
	const map = new Map<string, ArgSpec[]>(project_fragments(db).map((f) => [f.name, []]))
	for (const row of db.all<{ fragment: string; arg: string; type_raw: string | null }>(`
		SELECT doc.name AS fragment, dda.name AS arg, type_av.raw AS type_raw
		FROM document_directives dd
		JOIN documents doc ON doc.id = dd.document
		JOIN document_directive_arguments dda ON dda.parent = dd.id
		JOIN argument_values av ON av.id = dda.value
		LEFT JOIN argument_value_children avc ON avc.parent = av.id AND avc.name = 'type'
		LEFT JOIN argument_values type_av ON type_av.id = avc.value
		WHERE dd.directive = 'arguments' AND doc.kind = 'fragment'
	`)) {
		const list = map.get(row.fragment) ?? []
		list.push({ name: row.arg, type: row.type_raw?.replace(/^"|"$/g, '') ?? '' })
		map.set(row.fragment, list)
	}
	return map
}

// Arguments of each named list's field — used to live-validate @when(...).
export function all_list_field_arguments(db: Db): Map<string, ArgSpec[]> {
	const map = new Map<string, ArgSpec[]>(
		db
			.all<{ name: string }>(
				`SELECT DISTINCT name FROM discovered_lists WHERE name IS NOT NULL`
			)
			.map((r) => [r.name, [] as ArgSpec[]])
	)
	for (const row of db.all<{
		list: string
		arg: string
		type: string
		type_modifiers: string | null
	}>(`
		SELECT dl.name AS list, tfa.name AS arg, tfa.type, tfa.type_modifiers
		FROM discovered_lists dl
		JOIN selections s ON s.id = dl.list_field
		JOIN type_field_arguments tfa ON tfa.field = s.type
		WHERE dl.name IS NOT NULL
	`)) {
		const list = map.get(row.list) ?? []
		const depth = (row.type_modifiers?.match(/\]/g) ?? []).length
		list.push({
			name: row.arg,
			type: '['.repeat(depth) + row.type + (row.type_modifiers ?? ''),
		})
		map.set(row.list, list)
	}
	return map
}

export function list_exists(db: Db, listName: string): boolean {
	return !!db.get(`SELECT 1 FROM discovered_lists WHERE name = ? LIMIT 1`, [listName])
}

// Schema arguments of the field a list was declared on — the values that @when /
// @when_not filter by on list operation fragment spreads.
export function list_field_arguments(db: Db, listName: string): FieldInfo[] {
	return db.all<FieldInfo>(
		`SELECT tfa.name, tfa.type, tfa.type_modifiers, NULL AS description
		 FROM discovered_lists dl
		 JOIN selections s ON s.id = dl.list_field
		 JOIN type_field_arguments tfa ON tfa.field = s.type
		 WHERE dl.name = ?`,
		[listName]
	)
}
