import { graphql, useFragment } from '$houdini'

// GuardRow is NOT marked @plural, so handing useFragment the whole list of references should
// trip the runtime guard.
export default function GuardList({ users }: { users: any }) {
	const data = useFragment(
		users,
		graphql(`
			fragment GuardRow on User {
				id
				name
			}
		`)
	)

	return <div id="result">{JSON.stringify(data)}</div>
}
