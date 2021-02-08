// externals
import { GraphQLTagResult } from 'houdini-preprocess'
// locals
import { getEnvironment } from './environment'

export * from './environment'
export { default as query } from './query'
export { default as mutation } from './mutation'
export { default as fragment } from './fragment'

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export function fetchQuery({
	text,
	variables,
}: {
	text: string
	variables: { [name: string]: unknown }
}) {
	return getEnvironment()?.sendRequest({ text, variables })
}

// this template tag gets removed by the preprocessor so it should never be invoked.
// this function needs to return the same value as what the preprocessor leaves behind for type consistency
export function graphql(str: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error(
		"Looks like you don't have the preprocessor enabled. Encountered it at runtime wrapping: \n " +
			str[0]
	)
}
