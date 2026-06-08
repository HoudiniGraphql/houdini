# Deleted Documentation

A record of pages that have been explicitly removed during the 2.0 docs restructure, and why.

## Svelte-specific pages

| Former path | Title | Reason |
|---|---|---|
| `svelte/04-advanced-topics/06-svelte-5.mdx` | Svelte 5 | Outdated; removed |
| `svelte/04-advanced-topics/07-sveltekit.mdx` | SvelteKit | Outdated; removed |
| `svelte/04-advanced-topics/03-code-generation.mdx` | Code Generation | Duplicate of Reference → Vite Plugin |
| `svelte/04-advanced-topics/04-configuration.mdx` | Configuration | Duplicate of Reference → Config |
| `svelte/04-advanced-topics/09-plugins.mdx` | Plugin Directory | Page listed third-party plugins; removed pending new plugin registry |
| `svelte/04-advanced-topics/10-custom-scalars.mdx` | Custom Scalars | Thin wrapper; relevant content merged into Reference → Config |
| `svelte/04-advanced-topics/02-graphql-documents.mdx` | Working with GraphQL Documents | Outdated API guidance; content superseded by Core Topics pages |
| `svelte/04-advanced-topics/11-subscriptions.mdx` | Subscriptions (Advanced) | Duplicate of Core Topics → Subscription |
| `svelte/05-api/06-directives.mdx` | GraphQL Directives reference | Dissolved; each directive migrated to the relevant Core/Advanced Topic page |

## Shared pages

| Former path | Title | Reason |
|---|---|---|
| `shared/02-custom-scalars/01-custom-scalars.mdx` | Custom Scalars | Content already covered in Reference → Config; standalone removed |

## Extending Houdini — individual plugin pages

These four pages were merged into a single **Default Plugins** reference page (`shared/01-reference/05-default-plugins.mdx`):

| Former path | Title |
|---|---|
| `shared/extending-houdini/02-fetch.mdx` | Fetch Plugin |
| `shared/extending-houdini/03-query.mdx` | Query Plugin |
| `shared/extending-houdini/04-mutation.mdx` | Mutation Plugin |
| `shared/extending-houdini/05-subscription.mdx` | Subscription Plugin |

## Directives removed from docs

These directives were removed from the docs because they are no longer supported:

| Directive | Former location | Reason |
|---|---|---|
| `@blocking` | `svelte/03-core-topics/01-query.mdx` | No longer supported |
| `@blocking_disable` | `svelte/05-api/06-directives.mdx` | No longer supported |
