// externals
import { readable, Readable } from 'svelte/store'
import {
	getEnvironment as _getEnv,
	setEnvironment as _setEnv,
	Environment as Env,
} from './environment'

// 🤮
export const getEnvironment = _getEnv
export const setEnvironment = _setEnv
export const Environment = Env

// the compiled version of an operation
type TaggedGraphqlOperation = {
	name: string
	raw: string
}

// the result of the template tag (also what the compiler leaves behind in the artifact directory)
type GraphQLTagResult = Promise<TaggedGraphqlOperation>

export function getQuery(
	queryImport: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Readable<Promise<unknown>> {
	// grab the environment we're supposed to use
	const environent = _getEnv()
	if (!environent) {
		throw new Error('Could not find environment in context.')
	}

	// build up a promise that sends the query
	const queryPromise = new Promise(async (resolve, reject) => {
		// wait for the import to resolve
		const { raw } = await queryImport

		// trigger the environment's network function
		resolve(
			await environent.sendRequest<unknown>({
				text: raw,
				variables,
			})
		)
	})

	// wrap the promise in a store that we will update when we get to cache invalidation
	return readable(queryPromise, (set) => {})
}

// for type reasons, this function needs to return the same value as what the preprocessor leaves behind
export function graphql(query: TemplateStringsArray): GraphQLTagResult {
	// if this is executed, the preprocessor is not enabled
	throw new Error("Looks like you don't have the preprocessor enabled.")
}
