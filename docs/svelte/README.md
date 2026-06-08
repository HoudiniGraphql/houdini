# Svelte Docs

These files are fetched and rendered by [houdinigraphql.com](https://houdinigraphql.com).

## Structure

Files and directories are ordered by numeric prefix, which is stripped from URLs:

```
01-start/
  01-getting-started.mdx   → /svelte/v3/start/getting-started/
  02-installation.mdx      → /svelte/v3/start/installation/
02-core-topics/
  01-queries.mdx           → /svelte/v3/core-topics/queries/
```

## Frontmatter

Only `title` is required. `description` is used for SEO.

```yaml
---
title: Queries
description: How to fetch data with Houdini
---
```

## Importing shared content

Shared partials live in `packages/_docs/`. Import them using the `@shared` alias —
**do not use relative paths**, they will break when the files are fetched into the site.

```mdx
import FetchDocs from '@shared/sections/client-plugin-fetch.mdx'
```

## Importing site components

Astro components from the marketing site can be imported with `@components`:

```mdx
import AsideAccordion from '@components/docs/AsideAccordion.astro'
```
