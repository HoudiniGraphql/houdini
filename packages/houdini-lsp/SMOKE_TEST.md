# Smoke Test

## Automated coverage first

Most behavior is covered without an editor:

```sh
pnpm vitest run packages/houdini-lsp     # unit tests (extraction, validation rules, completions)
pnpm --filter houdini-lsp integration    # scripted LSP session over stdio against e2e/react
```

The integration script needs a full monorepo build (`pnpm build` at the root) and a clean
`e2e/react` working tree — a validation error anywhere in the project stops list-operation
generation and several checks depend on it.

## Setup

Build both packages (the pre-launch task does this automatically, but run it manually first to catch errors):

```sh
pnpm --filter houdini-lsp build
pnpm --filter houdini-graphql build
```

## Running

1. Open the worktree in VS Code:
   ```sh
   code /Users/alec/dv/houdini/worktrees/houdini-lsp
   ```

2. Press **F5** — VS Code will build both packages then launch an Extension Development Host with `e2e/react` as the workspace.

3. In the development host, open the **Output** panel and select **Houdini GraphQL** from the dropdown. Wait for `[houdini-lsp] ready` — this means the Go pipeline has initialized and all features are live.

## Things to test

### Diagnostics (as you type)
Live validation is the *real compiler*: on every (debounced) change the server overlays the buffer's documents into its database and runs the pipeline through validation, so every rule the compiler enforces squiggles without saving (~400ms). A thin fast pass covers syntax errors and `@with`/`@when` argument names + value types instantly (the pipeline anchors those in the fragment's file, so the fast pass owns their placement).

Things to try, all without saving: an unknown field, an unknown fragment spread (`...Foo`), `@with(notAnArg: 1)`, `@with(param: "wrong type")`, a fragment defined in one `graphql()` block and spread in another block of the same file (must NOT squiggle). Houdini patterns must never squiggle: fragment `@arguments`, bare `$variables` in fragments, `@list`.

Good file to start with: `src/routes/hello-world/+page.gql`

### Diagnostics (on save)
Save a file with an error — the same pipeline validates from disk and republishes (including cross-file errors, which live validation intentionally holds back). Fix and save again — squiggle clears.

### Inline documents
Open a `.tsx` with an inline `graphql(\`...\`)` template (eg `src/routes/list-id/+page.tsx`). Completions, hover, diagnostics, and go-to-definition should all work *inside* the template, and stay correctly positioned as you add/remove lines above it.

### Completions
Inside a selection set, type `{` then a space — field completions should appear from the schema. Try `@` for directive completions. After `...` you should see project fragments AND generated list operation fragments (`*_insert`, `*_remove`, ...), filtered to the parent type.

### Hover
Hover over a field name — should show its type and description from the schema.

### Go-to-definition
In a file that spreads a fragment, put the cursor on the fragment name and press **F12** (or right-click → Go to Definition). Should jump to the fragment's declaration — for list operation fragments, to the document that declared the `@list`.

### @with completions (the original #1576 fix)
Find or create a fragment spread with `@with(` and trigger completions — should show the argument names declared by that fragment's `@arguments` directive.

### @when completions
On a list operation spread (eg `...OptimisticKeyTest_insert @when(`), completions should list the arguments of the field the `@list` was declared on — not the type's fields.

## Checking the output channel

If something isn't working, the **Output → Houdini GraphQL** channel shows all `connection.console.log/error` output from the LSP server, including pipeline errors.
