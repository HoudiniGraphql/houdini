# Houdini Docs

All documentation for the Houdini marketing/docs site lives here.

```
docs/
  svelte/        ← houdini-svelte docs
  react/         ← houdini-react docs
  shared/        ← sidebar sections injected into every framework
  _partials/     ← MDX partials imported by framework docs
```

## Framework docs (`svelte/`, `react/`)

Standard doc pages. Use numeric prefixes for ordering — they are stripped from URLs.

Minimal frontmatter required:

```yaml
---
title: Getting Started
---
```

## Shared sidebar sections (`shared/`)

Directories in `shared/` are automatically appended to the bottom of every framework's sidebar. Pages live flat inside the section directory.

```
shared/
  01-client-plugins/
    01-fetch.mdx
    02-query.mdx
```

Sections inject at `100-`, `101-`, ... so they always sort after framework-specific content.

## Partials (`_partials/`)

MDX files imported into docs pages. Not routed as standalone pages — no frontmatter, no top-level headings.

Import using the `@shared` alias:

```mdx
import MyPartial from '@shared/_partials/my-partial.mdx'

<MyPartial />
```

**Never use relative paths** — they break when files are fetched into the marketing site.
