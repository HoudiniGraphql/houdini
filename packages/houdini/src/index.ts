// externals
import { Kind } from 'graphql/language'
import { getEnvironment } from './environment'

export * from './environment'

// the compiled version of an operation
type TaggedDocument = {
	name: string
	raw: string
}

export type TaggedGraphqlOperation = TaggedDocument & {
	kind: import('graphql/language').OperationDefinitionNode['kind']
}

export type TaggedGraphqlFragment = TaggedDocument & {
	kind: import('graphql/language').FragmentDefinitionNode['kind']
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

	// wrap the result in a store we can use to keep this query up to date
	return await currentEnv.sendRequest({ text, variables })
}

export function getFragment<T>(fragment: GraphQLTagResult, reference: T) {
	// make sure we got a query document
	if (fragment.kind !== Kind.FRAGMENT_DEFINITION) {
		throw new Error('getFragment can only take fragment documents')
	}
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(_: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
