import { buildSchema } from 'graphql'
import { describe, expect, test } from 'vitest'

import { validate_block, type HoudiniArgKnowledge } from './validation'

// the fast pass only covers syntax errors and @with/@when argument checks — every
// other rule comes from the compiler pipeline running against the buffer overlay

const schema = buildSchema(`
	directive @list(name: String!) on FIELD
	directive @with on FRAGMENT_SPREAD
	directive @arguments on FRAGMENT_DEFINITION
	directive @when on FRAGMENT_SPREAD
	type Query { user(id: ID!): User, users: [User!]! }
	type Mutation { addUser(name: String!): User }
	type User { id: ID!, name: String!, friends(favorites: Boolean): [User!]! }
	schema { query: Query, mutation: Mutation }
`)

const knowledge: HoudiniArgKnowledge = {
	fragments: new Map([
		[
			'UserAvatar',
			[
				{ name: 'size', type: 'Int' },
				{ name: 'param', type: 'Boolean' },
			],
		],
		['BareFragment', []],
	]),
	lists: new Map([['All_Users', [{ name: 'limit', type: 'Int' }]]]),
}

function diags(content: string, offsetLine = 0, offsetColumn = 0) {
	return validate_block(schema, { content, offsetLine, offsetColumn }, knowledge)
}

describe('syntax errors', () => {
	test('flagged with host coordinates', () => {
		const result = diags(`query Q { user( }`, 10)
		expect(result).toHaveLength(1)
		expect(result[0].range.start.line).toBe(10)
	})

	test('valid documents produce nothing (pipeline overlay owns semantics)', () => {
		expect(diags(`query Q { anything ...NotReal @nope }`)).toEqual([])
	})
})

describe('@with argument validation', () => {
	test('unknown argument is flagged with the declared list', () => {
		const result = diags(`query Q { user(id: "1") { ...UserAvatar @with(foo: 1) } }`)
		expect(result).toHaveLength(1)
		expect(result[0].message).toContain('"foo"')
		expect(result[0].message).toContain('(size, param)')
	})

	test('declared arguments stay clean', () => {
		expect(
			diags(`query Q { user(id: "1") { ...UserAvatar @with(size: 10, param: true) } }`)
		).toEqual([])
	})

	test('a fragment that declares no arguments is flagged', () => {
		const result = diags(`query Q { user(id: "1") { ...BareFragment @with(x: 1) } }`)
		expect(result[0]?.message).toContain('declares no arguments')
	})

	test('unknown fragments are skipped (database may lag the buffer)', () => {
		expect(diags(`query Q { user(id: "1") { ...NotSavedYet @with(anything: 1) } }`)).toEqual([])
	})

	test('a fragment defined in the block overrides the database', () => {
		const doc = `
			fragment UserAvatar on User @arguments(fresh: { type: "Int" }) { name }
			query Q { user(id: "1") { ...UserAvatar @with(fresh: 1) } }
		`
		expect(diags(doc)).toEqual([])
	})

	test('literal values are checked against the declared type', () => {
		const result = diags(`query Q { user(id: "1") { ...UserAvatar @with(param: "bar") } }`)
		expect(result).toHaveLength(1)
		expect(result[0].message).toContain('expected Boolean')
	})

	test('correctly typed literals and variables stay clean', () => {
		expect(
			diags(`query Q { user(id: "1") { ...UserAvatar @with(size: 3, param: false) } }`)
		).toEqual([])
		expect(diags(`query Q { user(id: "1") { ...UserAvatar @with(param: $flag) } }`)).toEqual([])
	})

	test('locally defined fragment types are respected', () => {
		const doc = `
			fragment UserAvatar on User @arguments(fresh: { type: "Boolean" }) { name }
			query Q { user(id: "1") { ...UserAvatar @with(fresh: 1) } }
		`
		expect(diags(doc)[0]?.message).toContain('expected Boolean')
	})
})

describe('@when filter validation', () => {
	test('unknown filter is flagged against the list field arguments', () => {
		const result = diags(
			`mutation M { addUser(name: "x") { ...All_Users_insert @when(bogus: true) } }`
		)
		expect(result).toHaveLength(1)
		expect(result[0].message).toContain('(limit)')
	})

	test('filter values are type-checked', () => {
		const result = diags(
			`mutation M { addUser(name: "x") { ...All_Users_insert @when(limit: "lots") } }`
		)
		expect(result).toHaveLength(1)
		expect(result[0].message).toContain('expected Int')
	})

	test('valid filters and unknown lists stay clean', () => {
		expect(
			diags(`mutation M { addUser(name: "x") { ...All_Users_insert @when(limit: 1) } }`)
		).toEqual([])
		expect(diags(`mutation M { addUser(name: "x") { ...Other_insert @when(x: 1) } }`)).toEqual(
			[]
		)
	})
})

describe('positions map to host-file coordinates', () => {
	test('column offset applies on the first line only', () => {
		const [diag] = validate_block(
			schema,
			{
				content: `query Q { user(id: "1") { ...UserAvatar @with(foo: 1) } }`,
				offsetLine: 4,
				offsetColumn: 30,
			},
			knowledge
		)
		expect(diag.range.start.line).toBe(4)
		expect(diag.range.start.character).toBeGreaterThan(30)
	})
})
