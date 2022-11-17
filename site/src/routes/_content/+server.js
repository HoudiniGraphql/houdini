import { json } from '@sveltejs/kit'

export async function GET() {
	return {
		// @ts-ignore
		body: json(REPLACE_WITH_CONTENT)
	}
}
