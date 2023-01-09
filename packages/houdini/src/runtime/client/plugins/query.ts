import { type SubscriptionSpec } from '../../lib'
import { type ClientPlugin } from '../documentObserver'

export const queryMiddleware: ClientPlugin = function () {
	// track the bits of state we need to hold onto
	let lastVariables = null
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {}
}
