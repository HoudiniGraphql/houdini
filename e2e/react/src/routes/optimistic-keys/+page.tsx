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
					delay: 2000
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
					delay: 5000
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
					data-test-action="add"
					onClick={() =>
						create({
							variables: { birthDate: new Date(), name: 'New User' },
							optimisticResponse: {
								addUser: {
									avatarURL: 'test',
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
							<td>{edge.node.avatarURL}</td>
							<td style={{ textAlign: 'right' }}>
								<button
									data-action={
										i === OptimisticKeyTest?.usersConnection.edges.length - 1
											? 'update'
											: null
									}
									onClick={async () => {
										const { errors } = await update({
											variables: {
												id: edge.node.id,
												avatarURL: 'a',
											},
											optimisticResponse: {
												updateUserByID: {
													id: edge.node.id,
													avatarURL: 'b',
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
