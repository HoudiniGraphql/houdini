import { useMutation, graphql } from '$houdini'
import React from 'react'

import { PageProps } from './$types'

export default function OptimisticKeyTestView({ OptimisticKeyTest }: PageProps) {
	const [error, setError] = React.useState('')

	const [_, update] = useMutation(
		graphql(`
			mutation OptimisticKeyTestUpdateMutation($id: ID!, $avatarURL: String!) {
				updateUserByID(
					id: $id
					snapshot: "OptimisticKeyTest"
					avatarURL: $avatarURL
					delay: 300
				) {
					id
					avatarURL
				}
			}
		`)
	)

	const [__, create] = useMutation(
		graphql(`
			mutation OptimisticKeyTestCreateMutation($name: String!, $birthDate: DateTime!) {
				addUser(
					snapshot: "OptimisticKeyTest"
					name: $name
					birthDate: $birthDate
					delay: 200
				) {
					id @optimisticKey
					...OptimisticKeyTest_insert @mask_disable @prepend
				}
			}
		`)
	)

	return (
		<>
			{error ? <div data-error="true">{error}</div> : null}
			<div>
				<button
					data-test-action="create"
					onClick={() =>
						create({
							variables: { birthDate: new Date(), name: 'New User' },
							optimisticResponse: {
								addUser: {
									avatarURL: 'optimistic value 1',
									name: 'New User',
								},
							},
						})
					}
				>
					Add User
				</button>
			</div>

			<table style={{ marginTop: 8, width: 1000, verticalAlign: 'middle' }}>
				<thead>
					<tr>
						<th>ID</th>
						<th>Name</th>
						<th>Avatar URL</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{OptimisticKeyTest?.usersConnection.edges.map((edge, i) => (
						<tr key={edge.node.id}>
							<td>{edge.node.id}</td>
							<td>{edge.node.name}</td>
							<td data-testid={i === 0 ? 'target' : ''}>{edge.node.avatarURL}</td>
							<td style={{ textAlign: 'right' }}>
								<button
									data-test-action={i === 0 ? 'update' : null}
									onClick={async () => {
										const { errors } = await update({
											variables: {
												id: edge.node.id,
												avatarURL: 'final value',
											},
											optimisticResponse: {
												updateUserByID: {
													id: edge.node.id,
													avatarURL: 'optimistic value 2',
												},
											},
										})
										if (errors) {
											setError(errors.map((e) => e.message).join(', '))
										}
									}}
								>
									Update
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	)
}
