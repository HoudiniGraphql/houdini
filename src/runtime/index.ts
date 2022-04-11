import { GraphQLTagResult } from './types'

export * from './network'
export * from './types'
export * from './proxy'

export { query, routeQuery, componentQuery } from './query'
export { mutation } from './mutation'
export { fragment } from './fragment'
export { subscription } from './subscription'
export { paginatedQuery, paginatedFragment } from './pagination'

// this template tag gets removed by the preprocessor so it should never be invoked.
// this function needs to return the same value as what the preprocessor leaves behind for type consistency
export function graphql(str: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
