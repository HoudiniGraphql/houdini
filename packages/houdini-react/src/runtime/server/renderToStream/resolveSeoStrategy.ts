// https://github.com/omrilotan/isbot
// https://stackoverflow.com/questions/34647657/how-to-detect-web-crawlers-for-seo-using-express/68869738#68869738
import { assertWarning } from '../utils'

export { resolveSeoStrategy }
export type { SeoStrategy }

type SeoStrategy = 'conservative' | 'google-speed'
function resolveSeoStrategy(options: { seoStrategy?: SeoStrategy; userAgent?: string } = {}): {
	disableStream: boolean
} {
	const seoStrategy: SeoStrategy = options.seoStrategy || 'conservative'

	if (!options.userAgent) {
		assertWarning(
			false,
			'Streaming disabled. Provide `options.userAgent` to enable streaming. (react-streaming needs the User Agent string in order to be able to disable streaming for bots, e.g. for Google Bot.) Or set `options.disable` to `true` to get rid of this warning.',
			{ onlyOnce: true }
		)
		return { disableStream: true }
	}
	const isGoogleBot = options.userAgent.toLowerCase().includes('googlebot')
	if (seoStrategy === 'google-speed' && isGoogleBot) {
		return { disableStream: false }
	}
	return { disableStream: true }
}
