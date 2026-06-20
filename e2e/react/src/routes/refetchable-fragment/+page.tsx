import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

const fragment = graphql(`
	fragment RefetchableUserInfo on User @refetchable @arguments(size: { type: "Int", default: 50 }) {
		name
		avatarURL(size: $size)
	}
`)

export default function ({ RefetchableFragmentQuery }: PageProps) {
	const handle = useFragmentHandle(RefetchableFragmentQuery.user, fragment)

	return (
		<>
			<div id="result">{handle.data?.avatarURL}</div>

			<button id="refetch" onClick={() => handle.refetch({ size: 100 })}>
				refetch
			</button>
			<button id="refetch-large" onClick={() => handle.refetch({ size: 200 })}>
				refetch large
			</button>
		</>
	)
}
