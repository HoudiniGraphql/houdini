export const getSiteUrl = () => {
	const nextUrl = 'https://docs-next-kohl.vercel.app'
	const currenttUrl = 'https://www.houdinigraphql.com'

	// in test, return currenttUrl
	if (process.env.TEST === 'true') {
		return currenttUrl
	}

	// Now, manual return... until automatic detection (hint bellow)
	return nextUrl

	// HOUDINI_VERSION is not replaced in runtime, only cmd
	// maybe in runtime we could check meta.json?
	// const version = 'HOUDINI_VERSION'

	// if (version.includes('next')) {
	// 	return 'https://docs-next-kohl.vercel.app'
	// }
	// return 'https://www.houdinigraphql.com'
}

/**
 * @param focus example "#0160"
 */
export const InfoReleaseNote = (focus?: string) => {
	return `❓ For more info, visit this guide: ${getSiteUrl()}/guides/release-notes${
		focus ? `${focus}` : ''
	}`
}

export const OutdatedFunctionInlineInfo = (
	type: 'query' | 'paginatedQuery' | 'mutation' | 'subscription',
	name: string
) => {
	return `❌ inline function "${type}" no longer exist (used with: '${name}' ${type}).`
}
