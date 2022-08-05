import { GraphQLTagResult } from './lib/types'

export * from './lib'
export * from './inline'
export * from './adapter'

// this template tag gets removed by the preprocessor so it should never be invoked.
// this function needs to return the same value as what the preprocessor leaves behind for type consistency
export function graphql(str: TemplateStringsArray): GraphQLTagResult {
	// if we are executing this function as part of the plugin, we need to return
	// the query instead of throwing an error. We don't want to bundle the graphql
	// module into the runtime so all we can do is return the query string
	try {
		if (globalThis.process.env.HOUDINI_PLUGIN) {
			// @ts-ignore: this is a totally internal type. the user will never see it, we won't
			//             and ever get a typed value of this since it's only used in the result of a dynamic
			//             import
			return str
		}
	} catch {}

	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
