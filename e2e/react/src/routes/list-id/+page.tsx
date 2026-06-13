import { useMutation, graphql } from '$houdini'
import { PageProps } from './$types'

export default function ListIDTestView({ ListIDTest }: PageProps) {
	const nodes = ListIDTest?.userNodes.nodes
	const listId = nodes?.__id

	const [, addUser] = useMutation(
		graphql(`
			mutation ListIDAddUser($name: String!, $birthDate: DateTime!, $listId: ID!) {
				addUser(snapshot: "ListIDTest", name: $name, birthDate: $birthDate) {
					...ListID_Users_insert @listID(value: $listId)
				}
			}
		`)
	)

	return (
		<>
			<ul>
				{nodes?.map((user) => (
					<li key={user.id} data-testid="user-row">
						{user.name}
					</li>
				))}
			</ul>
			<button
				data-test-action="add"
				onClick={() => {
					if (!listId) return
					addUser({
						variables: {
							name: 'New User',
							birthDate: new Date('2000-01-01'),
							listId,
						},
					})
				}}
			>
				Add User
			</button>
		</>
	)
}
