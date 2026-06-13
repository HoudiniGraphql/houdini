import { useMutation, graphql } from '$houdini'

import { PageProps } from './$types'

export default function UpsertFragmentTestView({ UpsertFragmentTest }: PageProps) {
	const users = UpsertFragmentTest?.usersList ?? []
	const firstUserId = users[0]?.id

	const [updateExisting] = useMutation(
		graphql(`
			mutation UpsertExisting($id: ID!, $name: String!) {
				updateUserByID(id: $id, snapshot: "UpsertFragmentTest", name: $name) {
					...UpsertFragmentTest_upsert
				}
			}
		`)
	)

	const [addNew] = useMutation(
		graphql(`
			mutation UpsertNew($name: String!, $birthDate: DateTime!) {
				addUser(snapshot: "UpsertFragmentTest", name: $name, birthDate: $birthDate) {
					...UpsertFragmentTest_upsert @prepend
				}
			}
		`)
	)

	return (
		<>
			<ul>
				{users.map((user) => (
					<li key={user.id} data-testid="user-row">
						{user.name}
					</li>
				))}
			</ul>
			<button
				data-test-action="update-existing"
				onClick={() => {
					if (!firstUserId) return
					updateExisting({ variables: { id: firstUserId, name: 'updated name' } })
				}}
			>
				Update Existing
			</button>
			<button
				data-test-action="add-new"
				onClick={() =>
					addNew({
						variables: { name: 'Brand New User', birthDate: new Date('2000-01-01') },
					})
				}
			>
				Add New
			</button>
		</>
	)
}
