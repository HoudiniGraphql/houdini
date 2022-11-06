export const siteURL = 'https://houdinigraphql.com'

export const houdini_mode = {
	/**
	 * to set the testing mode do like this:
	 * `process.env.HOUDINI_TEST = 'true'`
	 */
	get is_testing() {
		return process.env.HOUDINI_TEST === 'true'
	},
}
