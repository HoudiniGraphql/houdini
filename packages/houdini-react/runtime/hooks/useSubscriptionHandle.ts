import type {
	SubscriptionArtifact,
	GraphQLObject,
	GraphQLVariables,
	GraphQLError,
} from 'houdini/runtime'

import { useDocumentSubscription } from './useDocumentSubscription.js'

export type SubscriptionHandle<_Result extends GraphQLObject, _Input extends GraphQLVariables> = {
	data: _Result | null
	errors: GraphQLError[] | null
	variables: _Input
	listen: (args: { variables?: _Input }) => void
	unlisten: () => void
	fetching: boolean
}

// a hook to subscribe to a subscription artifact
export function useSubscriptionHandle<
	_Result extends GraphQLObject,
	_Input extends GraphQLVariables,
>({ artifact }: { artifact: SubscriptionArtifact }, variables: _Input) {
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
