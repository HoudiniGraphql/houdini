import { SubscriptionArtifact, GraphQLObject } from '$houdini/runtime/lib/types'

import { useDocumentSubscription } from './useDocumentSubscription'

export type SubscriptionHandle<_Result extends GraphQLObject, _Input extends {} | null> = {
	data: _Result | null
	errors: { message: string }[] | null
	variables: _Input
	listen: (args: { variables?: _Input }) => void
	unlisten: () => void
	fetching: boolean
}

// a hook to subscribe to a subscription artifact
export function useSubscriptionHandle<_Result extends GraphQLObject, _Input extends {}>(
	{ artifact }: { artifact: SubscriptionArtifact },
	variables: _Input
) {
	// a subscription is basically just a live document
	const [storeValue, observer] = useDocumentSubscription({
		artifact,
		variables,
	})

	return {
		data: storeValue.data,
		errors: storeValue.errors,
		fetching: storeValue.fetching,
		variables,
		unlisten: observer.cleanup,
		listen: observer.send,
	}
}
