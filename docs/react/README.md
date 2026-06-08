# React Docs

These files are fetched and rendered by [houdinigraphql.com](https://houdinigraphql.com).

## Structure

Files and directories are ordered by numeric prefix, which is stripped from URLs:

```
01-start/
  01-getting-started.mdx   → /react/v2/start/getting-started/
  02-installation.mdx      → /react/v2/start/installation/
02-react-framework/
  01-page-views.mdx        → /react/v2/react-framework/page-views/
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
