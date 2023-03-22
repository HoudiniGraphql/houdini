import { SubscriptionArtifact, GraphQLObject } from '$houdini/runtime/lib/types'

import { useDocumentSubscription } from './useDocumentSubscription'

// a hook to subscribe to a subscription artifact
export function useSubscription<_Result extends GraphQLObject, _Input extends {}>(
	{ artifact }: { artifact: SubscriptionArtifact },
	variables: _Input
) {
	// a subscription is basically just a live document
	const [storeValue, observer] = useDocumentSubscription({
		artifact,
		variables: variables,
	})

	return [storeValue]
}
