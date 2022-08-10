export async function post({ locals, request, ...args }) {
	const { mode } = await request.json()
	if (!['store', 'inline'].includes(mode)) {
		return {}
	}

	locals.session.data = { mode }

	return {
		body: 'OK'
	}
}
