import { graphql, useMutation } from '$houdini'

import { PageProps } from './$types'
import PluralUserList from './PluralUserList'

export default ({ features__plural_fragment }: PageProps) => {
	const firstId = features__plural_fragment.usersList[0]?.id

	// updating a single record in the cache should re-render just that row of the plural
	// fragment, driven by the per-item cache subscription (not by a prop change).
	const [update] = useMutation(
		graphql(`
			mutation PluralUpdateUser($id: ID!, $name: String!) {
				updateUserByID(id: $id, snapshot: "plural_fragment", name: $name) {
					id
					name
				}
			}
		`)
	)

	// inserting into the list grows the references array passed to the plural fragment, which
	// should re-subscribe and render the new row.
	const [addNew] = useMutation(
		graphql(`
			mutation PluralAddUser($name: String!, $birthDate: DateTime!) {
				addUser(snapshot: "plural_fragment", name: $name, birthDate: $birthDate) {
					...PluralUsers_insert @prepend
				}
			}
		`)
	)

	return (
		<>
			<PluralUserList users={features__plural_fragment.usersList} />
			<button
				data-test-action="update-first"
				onClick={() => firstId && update({ variables: { id: firstId, name: 'Updated Bruce' } })}
			>
				Update First
			</button>
			<button
				data-test-action="add-new"
				onClick={() =>
					addNew({ variables: { name: 'Brand New User', birthDate: new Date('2000-01-01') } })
				}
			>
				Add New
			</button>
		</>
	)
}
