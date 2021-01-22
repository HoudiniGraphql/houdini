// externals
import { currentEnv } from './environment'

export * from './environment'

// the compiled version of an operation
type TaggedGraphqlOperation = {
	name: string
	raw: string
}

// the result of the template tag (also what the compiler leaves behind in the artifact directory)
type GraphQLTagResult = Promise<TaggedGraphqlOperation>

export async function getQuery(
	queryImport: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Promise<unknown> {
	// wait for the import to resolve
	const { raw } = await queryImport

	// if there is no environment configured
	if (!currentEnv) {
		throw new Error('Please provide an environment')
	}

	// wrap the result in a store we can use to keep this query up to date
	return await currentEnv?.sendRequest({ text: raw, variables: {} })
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(query: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
