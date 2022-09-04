export const getSiteUrl = () => {
	// Now, manual return
	// TESTS Snapshots needs to be updated as well when changing this.
	const next_url = 'https://docs-next-kohl.vercel.app'
	return next_url

	// const current_url = 'https://www.houdinigraphql.com'
	// return next_url
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
