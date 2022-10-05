// this template tag gets removed by the preprocessor so it should never be invoked.
// this function must return any so that we can assign it a type in a variable declaration (ie an inline store)
import cache from './cache'
import type { Cache } from './cache/cache'

export * from './lib'

// ideally we would be able to parse the input for values but typescript does not yet support that kind of matches in template args
export function graphql(str: TemplateStringsArray): any {
	// if this is executed, the preprocessor is not enabled
	throw new Error(`⚠️ graphql template was invoked at runtime. This should never happen and usually means that your project isn't properly configured.

Please make sure you have the appropriate plugin/preprocessor enabled. For more information, visit this link: https://houdinigraphql.com/guides/setting-up-your-project
`)
}

export function getCache(): Cache {
	return cache
}
