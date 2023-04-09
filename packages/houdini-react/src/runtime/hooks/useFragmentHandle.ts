import type {
	GraphQLObject,
	FragmentArtifact,
	QueryArtifact,
	fragmentKey,
} from '$houdini/runtime/lib/types'

import { useDocumentHandle, type DocumentHandle } from './useDocumentHandle'
import { useDocumentStore } from './useDocumentStore'
import { fragmentReference, useFragment } from './useFragment'

// useFragmentHandle is just like useFragment except it also returns an imperative handle
// that users can use to interact with the fragment
export function useFragmentHandle<
	_Artifact extends FragmentArtifact,
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_PaginationArtifact extends QueryArtifact,
	_Input extends {} = {}
>(
	reference: _Data | { [fragmentKey]: _ReferenceType } | null,
	document: { artifact: FragmentArtifact; refetchArtifact?: QueryArtifact }
): DocumentHandle<_PaginationArtifact, _Data, _Input> {
	// get the fragment values
	const data = useFragment<_Data, _ReferenceType, _Input>(reference, document)

	// look at the fragment reference to get the variables
	const { variables } = fragmentReference<_Data, _Input, _ReferenceType>(reference, document)

	// use the pagination fragment for meta data if it exists.
	// if we pass this a fragment artifact, it won't add any data
	const [handleValue, handleObserver] = useDocumentStore<_Data, _Input>({
		artifact: document.refetchArtifact ?? document.artifact,
	})
	const handle = useDocumentHandle<_PaginationArtifact, _Data, _Input>({
		observer: handleObserver,
		storeValue: handleValue,
		artifact: document.refetchArtifact ?? document.artifact,
	})

	return {
		...handle,
		variables,
		data,
	}
}
