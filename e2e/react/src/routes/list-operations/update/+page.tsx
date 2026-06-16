import { useMutation, graphql } from '$houdini'

import { PageProps } from './$types'

export default function UpdateFragmentTestView({ UpdateFragmentTest }: PageProps) {
	const users = UpdateFragmentTest?.usersList ?? []
	const firstUserId = users[0]?.id

	const [updateExisting] = useMutation(
		graphql(`
			mutation UpdateExisting($id: ID!, $name: String!) {
				updateUserByID(id: $id, snapshot: "UpdateFragmentTest", name: $name) {
					...UpdateFragmentTest_update
				}
			}
		`)
	)

	const [updateNonMember] = useMutation(
		graphql(`
			mutation UpdateNonMember($name: String!, $birthDate: DateTime!) {
				addUser(snapshot: "UpdateFragmentTest", name: $name, birthDate: $birthDate) {
					...UpdateFragmentTest_update
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
				data-test-action="update-non-member"
				onClick={() =>
					updateNonMember({
						variables: { name: 'Should Not Appear', birthDate: new Date('2000-01-01') },
					})
				}
			>
				Update Non-Member
			</button>
		</>
	)
}
