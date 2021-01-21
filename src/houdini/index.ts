// externals
import { readable, Readable } from 'svelte/store'

// the compiled version of an operation
type TaggedGraphqlOperation = {
	name: string
	raw: string
}

// the result of the template tag (also what the compiler leaves behind in the artifact directory)
type GraphQLTagResult = Promise<TaggedGraphqlOperation>

export function getQuery<_QueryType extends TaggedGraphqlOperation>(
	queryImport: GraphQLTagResult
): Readable<string> {
	// we have to resolve the import and then fire the query
	queryImport.then(console.log)

	return readable(null, () => {})
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(query: TemplateStringsArray): GraphQLTagResult {
	return Promise.resolve({
		name: 'hello',
		raw: 'raw',
	})
}
