export const getSiteUrl = () => {
	const next_url = 'https://docs-next-kohl.vercel.app'
	const current_url = 'https://www.houdinigraphql.com'

	// in TEST, return current Url (for stable snapshots)
	try {
		if (process?.env?.TEST === 'true') {
			return current_url
		}
	} catch (error) {
		// This is failing in a client site navigation!
		// That's why it's in a try catch
	}

	// Now, manual return... until automatic detection (hint bellow)
	return next_url

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
	return `❌ inline function "${type}" no longer exist (update: '${name}' ${type}).`
}
