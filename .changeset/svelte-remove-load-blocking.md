---
'houdini-svelte': major
---

The `@load` and `@blocking` directives are no longer supported. Loading and blocking are now handled with native Svelte and SvelteKit primitives (async components, manual loads in `+page.js`, and the store's `.fetch()`).
