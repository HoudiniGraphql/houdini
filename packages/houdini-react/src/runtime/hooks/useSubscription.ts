import { SubscriptionArtifact, GraphQLObject } from '$houdini/runtime/lib/types'

import { useLiveDocument } from './useLiveDocument'

// a hook to subscribe to a subscription artifact
export function useSubscription<_Result extends GraphQLObject, _Input extends {}>(
	artifact: SubscriptionArtifact,
	variables: _Input
) {
	// a subscription is basically just a live document
	const [storeValue, observer] = useLiveDocument({
		artifact,
		variables: variables,
	})

	return [storeValue]
}
