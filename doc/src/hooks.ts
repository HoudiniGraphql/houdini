import { handleSession } from 'svelte-kit-cookie-session'

/** @type {import('@sveltejs/kit').GetSession} */
export async function getSession({ locals }) {
	return locals.session.data
}

// You can do it like this, without passing a own handle function
export const handle = handleSession({
	secret: import.meta.env.VITE_SESSION_SECRET
})
