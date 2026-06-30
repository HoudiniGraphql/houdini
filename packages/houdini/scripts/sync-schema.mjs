// Single-sources the orchestration database schema.
//
// The canonical schema is `create_schema` in src/lib/database.ts (node is the
// authority since it's what actually runs in production). This script extracts
// it verbatim into plugins/tests/schema.sql, which the Go test harness embeds.
// Run it whenever create_schema changes; a vitest guards against drift.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dbTs = path.join(here, '../src/lib/database.ts')
const out = path.join(here, '../../../plugins/tests/schema.sql')

const src = fs.readFileSync(dbTs, 'utf-8')
const match = src.match(/create_schema = `([\s\S]*?)`/)
if (!match) {
	throw new Error('could not find `create_schema` template literal in database.ts')
}

fs.writeFileSync(out, match[1])
console.log('wrote', path.relative(path.join(here, '../../..'), out))
