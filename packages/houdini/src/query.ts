// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledQueryKind } from 'houdini-compiler'
import { readable, Readable } from 'svelte/store'

export default function query(
	document: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Readable<unknown> {
	// make sure we got a query document
	if (document.kind !== CompiledQueryKind) {
		throw new Error('getQuery can only take query operations')
	}

	// wrap the result in a store we can use to keep this query up to date
	return readable(document.processResult(document.initialValue.data), (set) => {})
}
