import { GITHUB_TOKEN_TRIGGER_SPONSORS, WEBHOOK_PATH } from '$env/static/private'
import { json } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Handle} */
export const webhookHandle = async ({ event, resolve }) => {
	// if WEBHOOK_PATH is defined and the request match, let's go
	if (WEBHOOK_PATH && event.url.pathname === WEBHOOK_PATH) {
		// trigger the CI
		const result = await event.fetch(
			`https://api.github.com/repos/HoudiniGraphql/sponsors/actions/workflows/generate.yml/dispatches`,
			{
				method: 'POST',
				headers: {
					Accept: 'application/vnd.github+json',
					Authorization: `Bearer ${GITHUB_TOKEN_TRIGGER_SPONSORS}`,
					'X-GitHub-Api-Version': '2022-11-28'
				},
				body: JSON.stringify({ ref: 'main' })
			}
		)

		let data = null
		try {
			data = await result.json()
		} catch (error) {}

		return json({ status: result.status, statusText: result.statusText, data })
	}

	const response = await resolve(event)
	return response
}
