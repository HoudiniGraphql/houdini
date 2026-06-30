import { graphql, useMutation, useSubscription } from '$houdini'

const sub = graphql(`
	subscription UserUpdateSub($id: ID!, $snapshot: String) {
		userUpdate(id: $id, snapshot: $snapshot) {
			name
		}
	}
`)

// A mutation the test fires to advance the subscription: its mock handler flips the
// gate that releases the subscription's next payload, so the two operations interleave
// deterministically instead of racing.
const advance = graphql(`
	mutation AdvanceSubscription($id: ID!) {
		updateUserByID(id: $id, snapshot: "subscription-update", name: "advance") {
			id
			name
		}
	}
`)

export default function SubscriptionUpdatePage() {
	const data = useSubscription(sub, { id: '1', snapshot: 'test' })
	const [advanceSub] = useMutation(advance)

	return (
		<div>
			<div id="result">{data?.userUpdate?.name ?? 'waiting...'}</div>
			<button data-testid="advance" onClick={() => advanceSub({ variables: { id: '1' } })}>
				advance
			</button>
		</div>
	)
}
