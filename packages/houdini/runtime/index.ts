import { GraphQLTagResult } from './types'

export * from './network'
export * from './types'

export { default as query, routeQuery, componentQuery } from './query'
export { default as mutation } from './mutation'
export { default as fragment } from './fragment'
export { default as subscription } from './subscription'

// this template tag gets removed by the preprocessor so it should never be invoked.
// this function needs to return the same value as what the preprocessor leaves behind for type consistency
export function graphql(str: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
