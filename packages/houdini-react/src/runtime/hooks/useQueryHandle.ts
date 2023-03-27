import cache from '$houdini/runtime/cache'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { type QueryArtifact, GraphQLObject, CachePolicies } from '$houdini/runtime/lib/types'
import React from 'react'

import { createCache } from '../lib/cache'
import { DocumentHandle, useDocumentHandle } from './useDocumentHandle'
import { useDocumentStore } from './useDocumentStore'

// Suspense requires a way to throw a promise that resolves to a place
// we can put when we go back on a susequent render. This means that we have to have
// a stable way to identify _this_ useQueryHandle called.
// For now, we're going to compute an identifier based on the name of the artifact
// and the variables that we were given.
//
// - If we have a cached promise that's pending, we should just throw that promise
// - If we have a cached promise that's been resolved, we should return that value
//
// When the Component unmounts, we need to remove the entry from the cache (so we can load again)

const promiseCache = createCache<QuerySuspenseUnit>()
type QuerySuspenseUnit = {
	resolve: () => void
	resolved?: DocumentHandle<QueryArtifact, GraphQLObject, {}>
	then: (val: any) => any
}

export function useQueryHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
>(
	{ artifact }: { artifact: QueryArtifact },
	variables: any = null,
	config: UseQueryConfig = {}
): DocumentHandle<_Artifact, _Data, _Input> {
	// figure out the identifier so we know what to look for
	const identifier = queryIdentifier({ artifact, variables, config })
	// grab the document store
	const [storeValue, observer] = useDocumentStore<_Data, _Input>({
		artifact,
	})

	// compute the imperative handle for this artifact
	const handle = useDocumentHandle<_Artifact, _Data, _Input>({
		artifact,
		observer,
		storeValue,
	})

	// if the identifier changes, we need to remove the old identifier from the
	// suspense cache
	React.useEffect(() => {
		return () => {
			promiseCache.delete(identifier)
		}
	}, [identifier])

	// when we unmount, we need to clean up
	React.useEffect(() => {
		return () => {
			observer.cleanup()
		}
	}, [observer])

	// the value of this hook is by default, the

	// see if we have an entry in the cache for the identifier
	const suspenseValue = promiseCache.get(identifier)

	// if the promise has resolved, let's use that for our first render
	let result = handle.data

	// if we haven't loaded this value in awhile then we need to throw a promise
	// that we will catch when its done
	if (!suspenseValue || !deepEquals(storeValue.variables, variables)) {
		// we are going to cache the promise and then throw it
		// when it resolves the cached value will be updated
		// and it will be picked up in the next render
		let resolve: () => void = () => {}
		const loadPromise = new Promise<void>((r) => (resolve = r))

		const suspenseUnit: QuerySuspenseUnit = {
			then: loadPromise.then.bind(loadPromise),
			resolve,
			// @ts-ignore
			variables,
		}

		// @ts-ignore
		promiseCache.set(identifier, suspenseUnit)

		// before we suspend, let's see if we can read from the cache
		const cachedData = cache.read({ selection: artifact.selection, variables })

		if (!cachedData.data || (cachedData.partial && !artifact.partial)) {
			// the suspense unit gives react something to hold onto
			// and it acts as a place for us to register a callback on
			// send to update the cache before resolving the suspense
			handle
				.fetch({
					variables,
					// @ts-ignore: this is actually allowed... 🤫
					stuff: {
						silenceLoading: true,
					},
				})
				.then((value) => {
					// the final value
					suspenseUnit.resolved = {
						...handle,
						data: value.data,
						partia: value.partial,
						artifact,
					}

					suspenseUnit.resolve()
				})

			throw suspenseUnit
		}

		// @ts-ignore
		result = cachedData.data
	}

	// if the promise is still pending, we're still waiting
	if (!result && suspenseValue && !suspenseValue.resolved) {
		throw suspenseValue
	}

	// make sure we prefer the latest store value instead of the initial version we loaded on mount
	if (!result && suspenseValue?.resolved) {
		return suspenseValue.resolved as DocumentHandle<_Artifact, _Data, _Input>
	}

	return {
		...handle,
		variables: storeValue.variables,
		data: result,
	}
}

export type UseQueryConfig = {
	policy?: CachePolicies
	metadata?: App.Metadata
	fetchKey?: any
}

function queryIdentifier(args: {
	artifact: QueryArtifact
	fetchKey?: number
	variables: {}
	config: UseQueryConfig
}): string {
	// make sure there is always a fetchKey
	args.fetchKey ??= 0

	// pull the common stuff out
	const { artifact, variables, fetchKey } = args

	// a query identifier is a mix of its name, arguments, and the fetch key
	return [artifact.name, JSON.stringify(variables), fetchKey].join('@@')
}
