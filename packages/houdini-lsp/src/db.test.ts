// Integration tests against a real compiler-built database (e2e/react's
// .houdini/db.sqlite, produced by `pnpm generate`). The unit tests in
// completions.test.ts hand-craft their fixture rows, which necessarily encodes
// our own assumptions about how the Go pipeline stores things — this suite checks
// those assumptions against actual compiler output.
//
// Skipped (with a note) when the database is missing or built by an older schema:
// run `pnpm generate` in e2e/react to refresh it.

import { assertValidSchema } from 'graphql'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test, vi } from 'vitest'

import { schema_version } from '../../houdini/src/lib/database'
import { openDb, type Db } from '../../houdini/src/lib/db'
import {
	fragment_arguments,
	fragment_definition_location,
	list_exists,
	list_field_arguments,
	project_fragments,
} from './db_query'
import { schema_from_db } from './schema_from_db'

// the global setup stubs node:sqlite out; we need the real module
vi.unmock('node:sqlite')

const DB_PATH = fileURLToPath(new URL('../../../e2e/react/.houdini/db.sqlite', import.meta.url))

let db: Db | undefined
if (existsSync(DB_PATH)) {
	const candidate = await openDb(DB_PATH)
	const stamped = candidate.get<{ user_version: number }>('PRAGMA user_version')?.user_version
	if (stamped === schema_version) {
		db = candidate
	} else {
		candidate.close()
		console.warn('[houdini-lsp] e2e database is from an older schema — run `pnpm generate` in e2e/react')
	}
} else {
	console.warn('[houdini-lsp] no e2e database — run `pnpm generate` in e2e/react')
}

afterAll(() => db?.close())

describe.skipIf(!db)('compiled e2e database', () => {
	test('reconstructed schema is valid', () => {
		// graphql-js asserts this lazily on every validate() call; an invalid schema
		// crashes live validation, so it must hold for real compiler output
		expect(() => assertValidSchema(schema_from_db(db!))).not.toThrow()
	})

	test('user-written directives survive, machinery does not', () => {
		const schema = schema_from_db(db!)
		for (const name of ['list', 'when', 'with', 'arguments', 'paginate']) {
			expect(schema.getDirective(name), `@${name}`).toBeTruthy()
		}
		const custom = schema.getDirectives().filter((d) => d.name.startsWith('__'))
		expect(custom).toEqual([])
	})

	test('component fields appear as fields on their parent type', () => {
		const schema = schema_from_db(db!)
		const user = schema.getType('User')
		const fields = Object.keys((user as any).getFields())
		expect(fields).toContain('Avatar')
		expect(fields).toContain('CF_A_UserAvatar')
	})

	test('project_fragments: user fragments and list operations, no machinery', () => {
		const names = project_fragments(db!).map((f) => f.name)
		expect(names).toContain('UserInfo')
		expect(names).toContain('ListID_Users_insert')
		expect(names.filter((n) => n.startsWith('__'))).toEqual([])
	})

	test('fragment @arguments resolve for @with completions', () => {
		const args = fragment_arguments(db!, 'RefetchableUserInfo').map((a) => a.name)
		expect(args.sort()).toEqual(['param', 'size'])
	})

	test('list field arguments resolve for @when completions', () => {
		expect(list_exists(db!, 'OptimisticKeyTest')).toBe(true)
		const args = list_field_arguments(db!, 'OptimisticKeyTest').map((a) => a.name)
		expect(args).toContain('snapshot')
	})

	test('fragment definitions locate their source file', () => {
		const loc = fragment_definition_location(db!, 'RefetchableUserInfo')
		expect(loc?.filepath).toContain('refetchable-fragment/+page.tsx')
		expect(loc?.content).toContain('fragment RefetchableUserInfo')
	})
})
