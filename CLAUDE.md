# Houdini — Claude Notes

## Database

**Schema location**: `plugins/tests/test.go` (`WriteDatabaseSchema` const). No migration system — update it directly when adding/changing tables.

**Dual SQLite backends**: `plugins/db_zombiezen.go` (native, `!wasip1`) and `plugins/db_ncruces.go` (WASI, `wasip1`). Both implement the `Conn`/`Stmt`/`Row` interfaces in `plugins/conn.go`. All DB code must go through the interface.

**FK indices**: SQLite does not auto-create indices on FK columns, and none exist in this schema. Add an explicit `CREATE INDEX` in the schema const for any FK column that appears in a `WHERE` or `JOIN`.

**DEFERRABLE constraints**: Nearly all FKs are `DEFERRABLE INITIALLY DEFERRED` — constraint checks happen at `COMMIT`, not per-statement. This is intentional; pipeline steps batch-insert rows that temporarily violate FK integrity.

## Testing

**Heuristic**: Browser-verifiable changes require two tests: a Go table test asserting the generated artifact doesn't change, and a Playwright e2e test for the runtime behavior. Pure pipeline changes only need the table test.

| What changed | Test type |
|---|---|
| Go plugin logic only (extraction, validation, codegen) | `tests.RunTable` in `packages/<plugin>/plugin/` |
| Browser-visible behavior (mutations, pagination, cache) | `tests.RunTable` (artifact) + Playwright in `e2e/kit/` or `e2e/react/` (behavior) |
| TypeScript runtime or generated output shape | Vitest `.test.ts` next to source |

Canonical example: `packages/houdini-core/plugin/validate_test.go`. TypeScript test helpers: `testConfig()` / `testConfigFile()` in `packages/houdini/src/test/index.ts`.

## Documentation

Docs live in `/docs` — framework-specific content under `/docs/svelte` and `/docs/react`, shared content (reference, extending-houdini, meta) under `/docs/shared`.

When making changes, update the relevant doc pages alongside the code. This includes:
- New features or config options → add or expand the relevant page
- Changed behavior or API shape → update any pages that describe it
- New adapters or plugins → add an entry to the relevant reference page

The marketing site at `../marketing` symlinks directly into these directories, so doc changes are reflected immediately in the local dev server.

## Changesets

Every change needs a changeset. Keep the description to one or two sentences — no bullet lists.

## Tutorial sync

Fixes to tutorial shim/Go files must also update the houdini source templates: `shim.cjs`, `postInstall.js`, `db_ncruces.go`. No automated check enforces this.
