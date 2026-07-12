# Houdini GraphQL

GraphQL intelligence for [Houdini](https://houdinigraphql.com) projects, powered by the same compiler that builds your app.

## Features

- **Diagnostics as you type**: every rule the Houdini compiler enforces shows up live, without saving — including Houdini-specific checks like `@paginate` constraints, list operations, and per-spread `@with` arguments.
- **Completions**: schema fields, directives, project fragments (including generated list operations like `*_insert`), fragment arguments inside `@with(...)`, and list filters inside `@when(...)`. Required arguments sort first.
- **Inline documents**: everything works inside `graphql(` ... `)` calls and `GraphQL<` ... `>` props in TypeScript, JavaScript, and Svelte files, not just `.gql` files.
- **Hover & go-to-definition**: field documentation from your schema, and jump-to-definition for fragment spreads.
- **Syntax highlighting** for `.gql`/`.graphql` files and inline documents.

## Requirements

The language server ships with your project so it always matches your Houdini version: add `houdini-lsp` to your dev dependencies (new projects created with `create-houdini` include it).

```sh
npm install --save-dev houdini-lsp
```

The extension activates automatically in any workspace containing a `houdini.config.js` or `houdini.config.ts`.

## Coming from the official GraphQL extension?

Houdini projects don't need a `.graphqlrc` — without one, the official GraphQL extension stays idle and this extension takes over, with full knowledge of Houdini's directives and generated documents.
