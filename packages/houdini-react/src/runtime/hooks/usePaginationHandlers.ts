import { QueryArtifact } from '$houdini/runtime/lib/types'

import { useDocumentStore } from './useDocumentStore'

export function usePaginationHandlers({ artifact }: { artifact: QueryArtifact }) {
	const [storeValue, observer] = useDocumentStore({ artifact })
}
