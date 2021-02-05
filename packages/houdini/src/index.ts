// externals
import {
	GraphQLTagResult,
	TaggedQueryKind,
	TaggedMutationKind,
	TaggedFragmentKind,
} from 'houdini-preprocess'
import { doc } from 'prettier'
import { readable, Readable } from 'svelte/store'
// locals
import { getEnvironment } from './environment'

export * from './environment'

export function fetchQuery({
	text,
	variables,
}: {
	text: string
	variables: { [name: string]: unknown }
}) {
	return getEnvironment()?.sendRequest({ text, variables })
}

export function query(
	document: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Readable<unknown> {
	// make sure we got a query document
	if (document.kind !== TaggedQueryKind) {
		throw new Error('getQuery can only take query operations')
	}

	// wrap the result in a store we can use to keep this query up to date
	return readable(document.processResult(document.initialValue), (set) => {
		console.log('setting store')
	})
}

// mutation returns a handler that will send the mutation to the server when
// invoked
export function mutation(document: GraphQLTagResult) {
	// make sure we got a query document
	if (document.kind !== TaggedMutationKind) {
		throw new Error('getQuery can only take query operations')
	}
	// pull the query text out of the compiled artifact
	const { raw: text } = document

	// if there is no environment configured
	const currentEnv = getEnvironment()
	if (!currentEnv) {
		throw new Error('Please provide an environment')
	}

	// return an async function that sends the mutation go the server
	return async (variables: any) => {
		// grab the response from the server
		const { data } = await currentEnv.sendRequest({ text, variables })

		// wrap the result in a store we can use to keep this query up to date
		return document.processResult(data)
	}
}

// getFragment returns the requested data from the reference
export function getFragment<T>(fragment: GraphQLTagResult, reference: T) {
	// make sure we got a query document
	if (fragment.kind !== TaggedFragmentKind) {
		throw new Error('getFragment can only take fragment documents')
	}

	// dont be fancy yet, just pull out the fields we care about
	return fragment.applyMask(reference)
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
