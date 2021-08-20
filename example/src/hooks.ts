import cache from '$houdini/runtime/cache'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ request, render }) {
	// we're done
	return await render(request)
}
