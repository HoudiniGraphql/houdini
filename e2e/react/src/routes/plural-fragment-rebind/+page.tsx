import { graphql, useMutation } from '$houdini'
import { useState } from 'react'

import PluralUserList from '../plural-fragment/PluralUserList'
import { PageProps } from './$types'

export default ({ features__plural_fragment_rebind }: PageProps) => {
	const all = features__plural_fragment_rebind.usersList
	const lastId = all[all.length - 1]?.id

	// re-bind the plural fragment to a smaller set of parents (the first two members). This
	// changes which cache records the fragment is subscribed to.
	const [firstTwo, setFirstTwo] = useState(false)
	const shown = firstTwo ? all.slice(0, 2) : all

	// update a record that is NOT in the first-two subset. If the subscription to it was not
	// torn down when we re-bound, this update would leak back into the rendered list.
	const [updateLast] = useMutation(
		graphql(`
			mutation PluralRebindUpdate($id: ID!, $name: String!) {
				updateUserByID(id: $id, snapshot: "plural_rebind", name: $name) {
					id
					name
				}
			}
		`)
	)

	return (
		<>
			<PluralUserList users={shown} />
			<button data-test-action="show-first-two" onClick={() => setFirstTwo(true)}>
				First two
			</button>
			<button
				data-test-action="update-last"
				onClick={() => lastId && updateLast({ variables: { id: lastId, name: 'Off Screen Update' } })}
			>
				Update last
			</button>
		</>
	)
}
