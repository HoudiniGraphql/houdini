import { type SubscriptionSpec } from '../../lib'
import { type HoudiniMiddleware } from '../documentObserver'

export const queryMiddleware: HoudiniMiddleware = function () {
	// track the bits of state we need to hold onto
	let lastVariables = null
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {}
}
