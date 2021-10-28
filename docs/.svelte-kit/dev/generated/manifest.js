const c = [
	() => import('../../../src/routes/__layout.svelte'),
	() => import('../components/error.svelte'),
	() => import('../../../src/routes/index.svelte'),
	() => import('../../../src/routes/docs/__layout.svelte'),
	() => import('../../../src/routes/docs/index.md'),
	() => import('../../../src/routes/docs/contributing.md'),
	() => import('../../../src/routes/docs/installation.md'),
]

const d = decodeURIComponent

export const routes = [
	// src/routes/index.svelte
	[/^\/$/, [c[0], c[2]], [c[1]]],

	// src/routes/docs/index.md
	[/^\/docs\/?$/, [c[0], c[3], c[4]], [c[1]]],

	// src/routes/docs/contributing.md
	[/^\/docs\/contributing\/?$/, [c[0], c[3], c[5]], [c[1]]],

	// src/routes/docs/installation.md
	[/^\/docs\/installation\/?$/, [c[0], c[3], c[6]], [c[1]]],
]

export const fallback = [c[0](), c[1]()]
