import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from 'vitest'

import { create_schema } from './database.js'

// plugins/tests/schema.sql is generated from create_schema (the canonical
// source) and embedded by the Go test harness. If this fails, run
// `pnpm sync-schema` to regenerate it.
test('plugins/tests/schema.sql is in sync with create_schema', () => {
	const here = path.dirname(fileURLToPath(import.meta.url))
	const sqlPath = path.join(here, '../../../../plugins/tests/schema.sql')
	const onDisk = fs.readFileSync(sqlPath, 'utf-8')
	expect(onDisk).toBe(create_schema)
})
