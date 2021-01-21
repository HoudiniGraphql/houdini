// externals
import { readable, Readable } from 'svelte/store'

// a place to hold
type TaggedGraphqlQuery = {
	name: string
	raw: string
}

export function getQuery<_QueryType extends TaggedGraphqlQuery>(
	queryPromise: Promise<_QueryType>
): Readable<string> {
	// we have to resolve the import and then fire the query
	queryPromise.then(console.log)

	return readable(null, () => {})
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(query: TemplateStringsArray): Promise<TaggedGraphqlQuery> {
	return Promise.resolve({
		name: 'hello',
		raw: 'raw',
	})
}
