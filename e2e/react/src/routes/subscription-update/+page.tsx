import { graphql, useSubscription } from '$houdini'

const sub = graphql(`
	subscription UserUpdateSub($id: ID!, $snapshot: String) {
		userUpdate(id: $id, snapshot: $snapshot) {
			name
		}
	}
`)

export default function SubscriptionUpdatePage() {
	const data = useSubscription(sub, { id: '1', snapshot: 'test' })
	return <div id="result">{data?.userUpdate?.name ?? 'waiting...'}</div>
}
