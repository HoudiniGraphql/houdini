# Houdini — Claude Notes

## Database

**Schema location**: the canonical schema is the `create_schema` const in `packages/houdini/src/lib/database.ts` (node is the authority — it's what runs in production). `plugins/tests/schema.sql` is generated from it via `pnpm --filter houdini sync-schema` and embedded by the Go test harness; never edit the `.sql` by hand. A vitest (`src/lib/schema.test.ts`) fails if the two drift. No migration system — on a schema change the orchestration DB is rebuilt; it's version-stamped via `schema_version` / `PRAGMA user_version` (see `connect_db`), so persisted databases from older compilers are detected as stale and recreated.

**Dual SQLite backends**: `plugins/db_zombiezen.go` (native, `!wasip1`) and `plugins/db_ncruces.go` (WASI, `wasip1`). Both implement the `Conn`/`Stmt`/`Row` interfaces in `plugins/conn.go`. All DB code must go through the interface.

**FK indices**: SQLite does not auto-create indices on FK columns. Add an explicit `CREATE INDEX IF NOT EXISTS` in `create_schema` for any FK column that appears in a `WHERE` or `JOIN`.

**FK deferral**: FKs use `ON DELETE CASCADE`; deferral is achieved at the connection level via `PRAGMA defer_foreign_keys = ON` (set in `openDb` on the TS side and in the Go connection pragmas), so constraint checks happen at `COMMIT`, not per-statement. This is intentional; pipeline steps batch-insert rows that temporarily violate FK integrity. (The Go test pool doesn't enforce FKs at all.)

## Testing

**Heuristic**: Browser-verifiable changes require two tests: a Go table test asserting the generated artifact doesn't change, and a Playwright e2e test for the runtime behavior. Pure pipeline changes only need the table test.

| What changed | Test type |
|---|---|
| Go plugin logic only (extraction, validation, codegen) | `tests.RunTable` in `packages/<plugin>/plugin/` |
| Browser-visible behavior (mutations, pagination, cache) | `tests.RunTable` (artifact) + Playwright in `e2e/kit/` or `e2e/react/` (behavior) |
| TypeScript runtime or generated output shape | Vitest `.test.ts` next to source |

Canonical example: `packages/houdini-core/plugin/validate_test.go`. TypeScript test helpers: `testConfig()` / `testConfigFile()` in `packages/houdini/src/test/index.ts`.

## React route typing

Per-route TypeScript typing (which `params` and `search` a route accepts, the `RouteHrefs` union, scalar resolution) lives in **one** place: `packages/houdini-react/runtime/routes.ts`. It derives everything from the generated manifest's shape via `typeof rawManifest`, and exports `RouteHrefs`, `ParamsForRoute<H>`, `SearchForRoute<H>`, `NavTarget<H>`, and `Goto`.

Anything that navigates to or references a route (`<Link>`, `goto`, `createMock`, and any future navigation/href API) must consume these shared types rather than re-deriving the rules or generating per-route type maps in Go. `formatMockFile` in `packages/houdini-react/plugin/runtime.go` is the example to follow: it imports the shared types and only generates its own mock-data types. URL construction (filling params, appending search, marshaling custom scalars) similarly goes through `buildHref` in `runtime/resolve-href.ts` — don't hand-roll it.

## Documentation

Docs live in `/docs` — framework-specific content under `/docs/svelte` and `/docs/react`, shared content (reference, extending-houdini, meta) under `/docs/shared`.

When making changes, update the relevant doc pages alongside the code. This includes:
- New features or config options → add or expand the relevant page
- Changed behavior or API shape → update any pages that describe it
- New adapters or plugins → add an entry to the relevant reference page

**Mandatory check**: before finishing any code task, run `grep -rn <changed symbol> /docs` to find pages that reference it and verify they reflect the change. Do not skip this step.

**Internal links**: always use `~/path` (not `/path`) for cross-links between doc pages. Example: `[custom scalars](~/guides/custom-scalars)`. The path's section is the page's directory name with the numeric prefix stripped — `docs/shared/01-core/07-architecture.mdx` is linked as `~/core/architecture`, not `~/api/architecture`. Verify the section, not just the `~/` form.

**Prose punctuation**: avoid em-dashes in doc prose. Reach for the mark that fits the clause relationship: a period between two complete sentences, a semicolon between two closely-linked independent clauses, a colon to introduce an explanation/example/list, a comma for an appositive or trailing dependent clause, and parentheses for a mid-sentence aside. In `- term — description` bullet lists, use a colon (`- term: description`). Keep an em-dash only when nothing else reads as well (emphasis or a conversational beat). Don't trade one awkward mark for another: no double colon (a mid-sentence colon directly before a code-fence-introducing colon — use a period there), no double comma (an intro phrase like "For mutations," followed by ", since …" — keep the em-dash), and use a semicolon before conjunctive adverbs like "otherwise"/"however" to avoid a comma splice.

The marketing site at `../marketing` symlinks directly into these directories, so doc changes are reflected immediately in the local dev server.

## Changesets

Every non-documentation change needs a changeset. Doc-only changes do not need one. Each branch should have exactly one changeset. Keep the description to one or two sentences — no bullet lists.

Whenever a changeset bumps `houdini-core`, it must include a matching bump for `houdini` (the published runtime ships from `houdini`, so a core change needs a corresponding `houdini` release).
