import { ClientPlugin } from '../documentObserver'

export function subscriptionPlugin(client: SubscriptionHandler): ClientPlugin {
	return () => {
		return {}
	}
}

export type SubscriptionHandler = {
	subscribe: (
		payload: { query: string; variables?: {} },
		handlers: {
			next: (payload: { data?: {}; errors?: readonly { message: string }[] }) => void
			error: (data: {}) => void
			complete: () => void
		}
	) => () => void
}
