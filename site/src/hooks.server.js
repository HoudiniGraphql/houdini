import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error, event }) {
	const dead_links_redirect_to = {
		'/api/fragments': '/api/fragment',
		'/api/vite': '/api/vite-plugin',
		'/api/cli': '/api/command-line',
		'/intro/fragments': '/intro/reusing-parts-of-a-query',
		'/api/graphql': '/api/graphql-magic'
	}

	// If we have a value, let's redirect
	if (dead_links_redirect_to[event.url.pathname]) {
		throw redirect(303, dead_links_redirect_to[event.url.pathname])
	}
}
