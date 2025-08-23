export const load = async (event) => {
	const result = await event.fetch(
		'https://raw.githubusercontent.com/HoudiniGraphql/sponsors/main/generated/sponsors.svg'
	)
	return { svg: await result.text() }
}
