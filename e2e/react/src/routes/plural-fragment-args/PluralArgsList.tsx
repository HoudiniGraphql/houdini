import { graphql, type PluralArgsRow, useFragment } from '$houdini'

// a @plural fragment that also takes @arguments — the size variable is threaded per item.
export default function PluralArgsList({ users }: { users: PluralArgsRow }) {
	const data = useFragment(
		users,
		graphql(`
			fragment PluralArgsRow on User @plural @arguments(size: { type: "Int", default: 50 }) {
				id
				name
				avatarURL(size: $size)
			}
		`)
	)

	return (
		<ul id="plural-list">
			{data?.map((user) => (
				<li key={user.id} data-testid={user.id}>
					{user.name}
					<img alt={user.name} src={user.avatarURL} />
				</li>
			))}
		</ul>
	)
}
