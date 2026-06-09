# Houdini React Docs — Agreed Outline

## Status legend
- ✅ drafted (written to file)
- 🗒️ stub exists (notes only)
- 🔲 not started

---

## 1. Setting Up Your Project
- 01-getting-started.mdx ✅
- 02-deployment.mdx ✅
- Quick start (`npm create houdini@latest`)
- Project structure walkthrough
- IDE setup
- Configuration
- Deployment / adapters (picked early, project-level decision)

## 2. Routing
- 01-pages-and-layouts.mdx ✅ — pages, layouts, route groups, params, navigation + preloading
- 02-file-conventions.mdx 🗒️ — reference table of every + file and what it does
- 03-error-boundaries.mdx 🗒️ — no +error.jsx, just React error boundaries in +layout.jsx

## 3. Loading Data
- Queries 🗒️
  - +page.gql / +layout.gql model
  - Props injected by query name, must be destructured in signature
  - Layout queries wrap child routes
  - Variables wired from route params automatically
  - Imperative handles ($handle variant)
- Fragments 🔲
  - useFragment() hook
  - Colocation: each component declares exactly the data it needs
  - Loading states through fragments (@loading on fragment spreads)
  - Component fields (experimental)
- Loading States 🗒️
  - Shared partials for framework-agnostic content (@loading, count, cascade, fragment composition)
  - React-specific: isPending (not === PendingValue), @loading implies Suspense boundary
- Pagination 🗒️
  - Cursor-based and offset/limit
  - $handle.loadNextPage / loadPreviousPage
  - Fragment pagination
- Subscriptions 🔲
  - useSubscription() hook
  - Real-time cache updates
- Your GraphQL Server 🗒️
  - +schema exports executable schema, Houdini wraps in Yoga
  - +yoga for custom instance (context injection, plugins) — +schema still required
  - True BFF: in-memory SSR resolution, no network hop
  - Security: schema not publicly reachable, no client-visible surface area beyond queries

## 4. Updating Data 🔲
- Mutations
- Optimistic Updates (@optimisticResponse, auto-rollback on error)
- Updating Lists (@list, @append, @prepend, @remove, @allLists)
- Cache (policies, record identity, manual writes)

## 5. Guides 🔲
- Authentication (React-specific)
- TypeScript (React-specific)
- Error Handling (shared partial — also pulled into Svelte docs)
- Nullability (shared partial — also pulled into Svelte docs)
- File Uploads (shared partial — also pulled into Svelte docs)
- Trusted Documents (shared partial — also pulled into Svelte docs)
- Custom Scalars (shared partial — already exists at shared/_partials/custom-scalars.mdx)

## 6. Reference 🔲
- Config
- CLI
- Vite Plugin
- Client API
- Directives
- Codegen Plugins

---

## Notes
- Introduction comes last (write after everything else so framing is sharp)
- Loading States partials also need to be extracted from the Svelte doc
- "Your GraphQL Server" title chosen over "Local APIs" — more self-explanatory
