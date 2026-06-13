# Smoke Test

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

### Diagnostics (on save)
Open any `.gql` file and introduce an error (reference a field that doesn't exist). Save. A red squiggle should appear with the Houdini validation message. Fix it and save again — squiggle clears.

Good file to start with: `src/routes/hello-world/+page.gql`

### Completions
Inside a selection set, type `{` then a space — field completions should appear from the schema. Try `@` for directive completions.

### Hover
Hover over a field name — should show its type and description from the schema.

### Go-to-definition
In a file that spreads a fragment, put the cursor on the fragment name and press **F12** (or right-click → Go to Definition). Should jump to the fragment's declaration file.

### @with completions (the original #1576 fix)
Find or create a fragment spread with `@with(` and trigger completions — should show the argument names declared by that fragment's `@arguments` directive.

## Checking the output channel

If something isn't working, the **Output → Houdini GraphQL** channel shows all `connection.console.log/error` output from the LSP server, including pipeline errors.
