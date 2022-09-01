export const getSiteUrl = () => {
	const version = 'HOUDINI_VERSION'
	if (version.includes('next')) {
		return 'https://docs-next-kohl.vercel.app'
	}
	return 'https://www.houdinigraphql.com'
}
