import type {
	SubscriptionArtifact,
	GraphQLObject,
	GraphQLVariables,
} from '$houdini/runtime/lib/types'

import { useSubscriptionHandle } from './useSubscriptionHandle'

// a hook to subscribe to a subscription artifact
export function useSubscription<_Result extends GraphQLObject, _Input extends GraphQLVariables>(
	document: { artifact: SubscriptionArtifact },
	variables: _Input
) {
	const { data } = useSubscriptionHandle(document, variables)
	return data
}
