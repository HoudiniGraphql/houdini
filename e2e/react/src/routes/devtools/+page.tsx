import { graphql, useMutation } from '$houdini'

import type { PageProps } from './$types'

export default function ({ DevtoolsQuery }: PageProps) {
	const [update] = useMutation(
		graphql(`
			mutation DevtoolsUpdateMutation($snapshot: String!, $id: ID!, $name: String!) {
				updateUser(id: $id, snapshot: $snapshot, name: $name) {
					id
					name
				}
			}
		`)
	)

	return (
		<>
			<div id="result">{DevtoolsQuery.hello}</div>
			<button
				id="trigger-mutation"
				onClick={() =>
					update({
						variables: { snapshot: 'devtools', id: '1', name: 'Devtools User' },
					})
				}
			>
				mutate
			</button>
		</>
	)
}
