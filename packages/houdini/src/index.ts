// externals
import { Kind } from 'graphql/language'
import { getEnvironment } from './environment'
import { CompiledGraphqlOperation, CompiledGraphqlFragment } from 'houdini-compiler'

export * from './environment'

// the preprocessor might leave behind fields that the compiler doesn't. Those extra fields are
// registered in the 'Tagged' variants

type TaggedGraphqlOperation = CompiledGraphqlOperation & {
	processResult: (result: any) => any
}

type TaggedGraphqlFragment = CompiledGraphqlFragment & {
	selector: (root: any) => any
}

// the result of the template tag (also what the compiler leaves behind in the artifact directory)
export type GraphQLTagResult = TaggedGraphqlOperation | TaggedGraphqlFragment

export async function getQuery(
	document: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Promise<unknown> {
	// make sure we got a query document
	if (document.kind !== Kind.OPERATION_DEFINITION) {
		throw new Error('getQuery can only take query operations')
	}

	// wait for the import to resolve
	const { raw: text } = document

	// if there is no environment configured
	const currentEnv = getEnvironment()
	if (!currentEnv) {
		throw new Error('Please provide an environment')
	}

	// grab the response from the server
	const { data } = await currentEnv.sendRequest({ text, variables })

	// wrap the result in a store we can use to keep this query up to date
	return { data: document.processResult(data) }
}

export function getFragment<T>(fragment: GraphQLTagResult, reference: T) {
	// make sure we got a query document
	if (fragment.kind !== Kind.FRAGMENT_DEFINITION) {
		throw new Error('getFragment can only take fragment documents')
	}

	// dont be fancy yet, just pull out the fields we care about
	return fragment.selector(reference)
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(_: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
