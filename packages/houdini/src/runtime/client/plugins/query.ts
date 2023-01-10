import { type SubscriptionSpec, ArtifactKind } from '../../lib'
import { type ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'

export const queryPlugin: ClientPlugin = documentPlugin(ArtifactKind.Query, function () {
	// track the bits of state we need to hold onto
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {}
})
