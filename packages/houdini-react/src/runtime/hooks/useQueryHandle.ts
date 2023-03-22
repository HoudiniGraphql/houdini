import { cache } from '$houdini/runtime'
import {
	type QueryArtifact,
	ArtifactKind,
	GraphQLObject,
	CachePolicies,
} from '$houdini/runtime/lib/types'
import React from 'react'

import { DocumentHandle, useDocumentHandle } from './useDocumentHandle'
import { useDocumentSubscription } from './useDocumentSubscription'

export function useQueryHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends {} = []
>(
	{ artifact }: { artifact: QueryArtifact },
	variables: any = null,
	config: UseQueryConfig = {}
): [_Data, DocumentHandle<_Artifact, _Data, _Input>] {
	const [storeValue, observer] = useDocumentSubscription<QueryArtifact, _Data, _Input>({
		artifact,
		variables,
		send: {
			metadata: config?.metadata,
		},
	})

	// if we don't have any data in the observer yet, see if we can load from the cache.
	// if we do have the data in the cache then we want to use that value as the result of
	// this hook so we need to use it without going to the network
	let localData: _Data | null = null

	// memoize the cached value so that we only look it up when necessary
	// TODO: this fires _way_ too often in the simple cases. we need to figure out how to prevent
	// unnecessary rerenders.
	const cachedValue = React.useMemo(() => {
		return (
			!storeValue.data &&
			!storeValue.errors &&
			artifact.kind === ArtifactKind.Query &&
			cache.read({ query: { artifact, variables } })
		)
	}, [Boolean(storeValue.data), Boolean(storeValue.errors), artifact.kind, variables])
	if (cachedValue) {
		// TODO: what to do about cache policy here?
		//       we rely on the cache as the way to look up values after suspending (since can't get the resolved values)
		//       if the cache policy doesn't allow us to use cached values, we need _another_ way of getting suspended values

		// if we can't load from the cache then we have to suspend until we can
		// NOTE: this is the bit that prevents infinite suspense loops. By suspending until
		// send() is finished, data won't be null next time we come back here
		//
		// we can't use the cached value if:
		// - it doesn't exist
		// - its partial but the artifact doesn't allow it
		const allowed =
			Boolean(cachedValue.data) &&
			(!cachedValue.partial || (artifact.kind === ArtifactKind.Query && artifact.partial))
		if (!allowed) {
			throw observer.send({
				variables,
				// TODO: session/metadata
				session: {},
				metadata: {},
			})
		}

		// use the cache version for the first non-suspense'd mount of this hook
		localData = cachedValue.data as unknown as _Data
	}

	// if the store is fetching then we need to suspend until the
	// store is ready for us
	if (storeValue.fetching && observer.pendingPromise) {
		throw observer.pendingPromise
	}

	// compute the meta object for this artifact
	const handle = useDocumentHandle<_Artifact, _Data, _Input>({
		artifact,
		observer,
		storeValue,
	})

	// make sure we prefer the latest store value instead of the initial version we loaded on mount
	return [storeValue.data ?? localData!, handle]
}

export type UseQueryConfig = {
	policy?: CachePolicies
	metadata?: App.Metadata
}
