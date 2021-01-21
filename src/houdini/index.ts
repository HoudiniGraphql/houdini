import { readable, Readable } from 'svelte/store'

// a place to hold

type TaggedGraphqlQuery = {
	name: string
	responseType: string
}

export function getQuery<_QueryType extends TaggedGraphqlQuery>(
	query: TaggedGraphqlQuery
): Readable<_QueryType['responseType']> {
	return readable(null, () => {})
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(query: TemplateStringsArray): TaggedGraphqlQuery {
	return {
		name: 'hello',
		responseType: '',
	}
}
