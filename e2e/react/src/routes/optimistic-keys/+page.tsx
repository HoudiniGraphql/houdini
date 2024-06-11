import { useMutation, graphql } from '$houdini'

import { PageProps } from './$types'

export default function OptimisticKeyTestView({ OptimisticKeyTest }: PageProps) {
	const [_, update] = useMutation(
		graphql(`
			mutation OptimisticKeyTestMutation($id: ID!, $avatarURL: String!) {
				updateUser(id: $id, snapshot: "foo", avatarURL: $avatarURL) {
					id
					avatarURL
				}
			}
		`)
	)

	return (
		<>
			<div>
				<button data-test-action="add">Add User</button>
			</div>
			{OptimisticKeyTest?.usersConnection.edges.map((edge) => (
				<div key={edge.node.id}>
					{edge.node.id}: <span style={{ margin: '0 10px' }}>{edge.node.name}</span>
					<button
						data-action-update={edge.node.id}
						onClick={() => update({ variables: { id: edge.node.id, avatarURL: 'a' } })}
					>
						Update
					</button>
				</div>
			))}
		</>
	)
}
