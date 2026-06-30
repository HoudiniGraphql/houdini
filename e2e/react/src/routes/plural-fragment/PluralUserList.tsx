import { graphql, type PluralUserRow, useFragment } from '$houdini'

type Props = {
	// the @plural fragment reference type is already an array
	users: PluralUserRow
}

// PluralUserList receives the whole list of users at once and reads them back through a
// single useFragment call thanks to @plural.
export default function PluralUserList({ users }: Props) {
	const data = useFragment(
		users,
		graphql(`
			fragment PluralUserRow on User @plural {
				id
				name
			}
		`)
	)

	return (
		<ul id="plural-list">
			{data?.map((user) => (
				<li key={user.id} data-testid={user.id}>
					{user.name}
				</li>
			))}
		</ul>
	)
}
