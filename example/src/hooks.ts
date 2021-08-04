import cache from '$houdini/runtime/cache'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ request, render }) {
	// make sure that the server side cache is cleared before every request so that
	// we don't accidentally load sensitive user information across sessions when SSR'ing
	// a request
	cache.clear()

	// we're done
	return await render(request)
}
