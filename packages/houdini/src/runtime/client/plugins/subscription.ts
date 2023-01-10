import { ArtifactKind } from '../../lib'
import { ClientPlugin } from '../documentObserver'
import { documentPlugin } from '../utils'

export function subscriptionPlugin(client: SubscriptionHandler): ClientPlugin {
	return documentPlugin(ArtifactKind.Subscription, () => {
		return {}
	})
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
