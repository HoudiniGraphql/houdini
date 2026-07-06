import { getTokenAtPosition, Position as GQLPosition } from 'graphql-language-service'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

// the global setup stubs node:sqlite out; these tests exercise real queries
// against the real schema, so restore the actual module
vi.unmock('node:sqlite')

import { create_schema } from '../../houdini/src/lib/database'
import { openDb, type Db } from '../../houdini/src/lib/db'
import {
	definition_position,
	houdiniCompletions,
	houdiniDirectiveContext,
	in_arguments,
	required_first,
} from './completions'
import {
	fragment_arguments,
	fragment_definition_location,
	list_exists,
	list_field_arguments,
	project_fragments,
} from './db_query'

let db: Db

// a minimal project: a user fragment (UserRow, declaring @arguments), a component
// field fragment (generated), and a named list (All_Users on Query.users) with its
// generated operation fragments
beforeAll(async () => {
	db = await openDb(':memory:')
	db.exec(create_schema)

	// schema types + fields
	db.run(`INSERT INTO types (name, kind, built_in) VALUES
		('Query', 'OBJECT', 0), ('User', 'OBJECT', 0),
		('Int', 'SCALAR', 1), ('String', 'SCALAR', 1), ('Boolean', 'SCALAR', 1)`)
	db.run(`UPDATE types SET operation = 'query' WHERE name = 'Query'`)
	db.run(`INSERT INTO type_fields (id, parent, name, type, type_modifiers) VALUES
		('Query.users', 'Query', 'users', 'User', '!]!'),
		('User.name', 'User', 'name', 'String', '!')`)
	db.run(`INSERT INTO type_field_arguments (id, field, name, type, type_modifiers) VALUES
		('Query.users.limit', 'Query.users', 'limit', 'Int', '!'),
		('Query.users.offset', 'Query.users', 'offset', 'Int', NULL)`)

	// raw document holding the fragment definition (offsets are 0-based)
	db.run(`INSERT INTO raw_documents (id, filepath, content, offset_line, offset_column) VALUES
		(1, 'src/UserRow.tsx', '
	fragment UserRow on User {
		name
	}
', 10, 22)`)

	// documents: user fragment, generated component field, list operation, query
	db.run(`INSERT INTO documents (id, name, kind, type_condition, raw_document, generated) VALUES
		(1, 'UserRow', 'fragment', 'User', 1, false),
		(2, '__componentField__User_Avatar', 'fragment', 'User', 1, true),
		(3, 'All_Users_insert', 'fragment', 'User', 1, true),
		(4, 'AllUsers', 'query', NULL, 1, false)`)

	// UserRow declares @arguments(size: { type: "Int!" }, param: { type: "Boolean" })
	db.run(`INSERT INTO directives (name) VALUES ('arguments')`)
	db.run(`INSERT INTO document_directives (id, document, directive, row, column) VALUES
		(1, 1, 'arguments', 0, 0)`)
	db.run(`INSERT INTO argument_values (id, kind, raw, row, column, expected_type, document) VALUES
		(1, 'Object', '', 0, 0, '', 1),
		(2, 'String', '"Int!"', 0, 0, '', 1),
		(3, 'Object', '', 0, 0, '', 1),
		(4, 'String', '"Boolean"', 0, 0, '', 1)`)
	db.run(`INSERT INTO argument_value_children (name, parent, value, row, column, document) VALUES
		('type', 1, 2, 0, 0, 1),
		('type', 3, 4, 0, 0, 1)`)
	db.run(`INSERT INTO document_directive_arguments (parent, name, value) VALUES
		(1, 'size', 1), (1, 'param', 3)`)

	// the All_Users list, declared on Query.users
	db.run(`INSERT INTO selections (id, field_name, kind, type) VALUES
		(1, 'users', 'field', 'Query.users')`)
	db.run(`INSERT INTO discovered_lists
		(name, node_type, connection_type, node, page_size, document, mode, embedded, target_type, list_field)
		VALUES ('All_Users', 'User', '', 1, 10, 4, 'Infinite', false, 'all', 1)`)
})

afterAll(() => db.close())

describe('project_fragments', () => {
	test('hides generated fragments but keeps list operations', () => {
		const names = project_fragments(db).map((f) => f.name)
		expect(names).toContain('UserRow')
		expect(names).toContain('All_Users_insert')
		expect(names).not.toContain('__componentField__User_Avatar')
	})
})

describe('@with / @arguments completions', () => {
	test("completes the fragment's declared arguments, required first", () => {
		const items = houdiniCompletions({ kind: 'with', fragmentName: 'UserRow' }, db)
		// clients order by sortText — required (non-null) args sort ahead
		const ordered = [...items].sort((a, b) => a.sortText!.localeCompare(b.sortText!))
		expect(ordered.map((i) => [i.label, i.detail, i.sortText])).toEqual([
			['size', 'Int!', '0size'],
			['param', 'Boolean', '1param'],
		])
		expect(ordered[0].insertText).toBe('size: ')
	})

	test('context is detected from the token state, including unclosed parens', () => {
		const text = 'query Q {\n\tusers {\n\t\t...UserRow @with(\n\t}\n}\n'
		const line = 2
		const character = text.split('\n')[line].length
		const token = getTokenAtPosition(text, new GQLPosition(line, character), 1)
		expect(houdiniDirectiveContext(token.state)).toEqual({
			kind: 'with',
			fragmentName: 'UserRow',
		})
	})
})

describe('@when completions', () => {
	test("list operation spreads complete the list field's arguments", () => {
		expect(list_exists(db, 'All_Users')).toBe(true)
		const items = houdiniCompletions({ kind: 'when', fragmentName: 'All_Users_insert' }, db)
		expect(items.map((i) => [i.label, i.sortText])).toEqual([
			['limit', '0limit'],
			['offset', '1offset'],
		])
	})

	test('an argument-less list field completes to nothing (not type fields)', () => {
		expect(list_field_arguments(db, 'No_Such_List')).toEqual([])
	})
})

describe('argument ordering helpers', () => {
	test('in_arguments stops at the enclosing selection set', () => {
		const text = 'query Q {\n\tusers(\n}\n'
		const inArgs = getTokenAtPosition(text, new GQLPosition(1, '\tusers('.length), 1)
		expect(in_arguments(inArgs.state)).toBe(true)

		const inSelection = getTokenAtPosition(text, new GQLPosition(1, 1), 1)
		expect(in_arguments(inSelection.state)).toBe(false)
	})

	test('required_first reads the type from item.type, labelDetails, or detail', () => {
		const sorted = required_first([
			{ label: 'a', detail: 'Int' },
			{ label: 'b', detail: 'Int!' },
			{ label: 'c', labelDetails: { detail: ' String!' } },
			{ label: 'd', ...{ type: 'ID!' } },
		])
		expect(sorted.map((i) => i.sortText)).toEqual(['1a', '0b', '0c', '0d'])
	})
})

describe('go-to-definition', () => {
	test('lands on the fragment keyword inside the raw document', () => {
		const loc = fragment_definition_location(db, 'UserRow')
		expect(loc?.filepath).toBe('src/UserRow.tsx')
		// content starts at (10, 22); `fragment UserRow` is on the next line, tab-indented
		expect(definition_position(loc!, 'UserRow')).toEqual({ line: 11, character: 1 })
	})

	test('falls back to the document offset when the keyword is missing', () => {
		expect(
			definition_position(
				{ filepath: 'x', line: 3, column: 7, content: '{ inline { spread } }' },
				'Nope'
			)
		).toEqual({ line: 3, character: 7 })
	})
})
