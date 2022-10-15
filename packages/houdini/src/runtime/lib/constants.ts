export const siteURL = 'SITE_URL'

/**
 * @param focus example "#0160"
 */
export const InfoReleaseNote = (focus?: string) => {
	return `❓ For more info, visit this guide: ${siteURL}/guides/release-notes${
		focus ? `${focus}` : ''
	}`
}

export const OutdatedFunctionInlineInfo = (
	type: 'query' | 'paginatedQuery' | 'mutation' | 'subscription',
	name: string
) => {
	return `❌ inline function "${type}" no longer exist (update: '${name}' ${type}).`
}
