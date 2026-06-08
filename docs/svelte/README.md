# Svelte Docs

These files are fetched and rendered by [houdinigraphql.com](https://houdinigraphql.com).

## Structure

Files and directories are ordered by numeric prefix, which is stripped from URLs:

```
01-your-first-app/
  00-getting-started.mdx   → /svelte/v3/your-first-app/getting-started/
  01-queries.mdx           → /svelte/v3/your-first-app/queries/
02-setup/
  01-installation.mdx      → /svelte/v3/setup/installation/
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
