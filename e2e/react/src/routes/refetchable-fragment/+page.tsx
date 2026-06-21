import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

const fragment = graphql(`
	fragment RefetchableUserInfo on User @refetchable @arguments(size: { type: "Int", default: 50 }, param: { type: "Boolean", default: false }) {
		name
		avatarURL(size: $size)
		testField(someParam: $param)
	}
`)

export default function ({ RefetchableFragmentQuery }: PageProps) {
	const handle = useFragmentHandle(RefetchableFragmentQuery.user, fragment)

	return (
		<>
			<div id="result">{handle.data?.avatarURL}</div>
			{/* testField reflects the `param` argument; we refetch only `size`, so this must survive */}
			<div id="merge">{handle.data?.testField}</div>
			{/* variables reflect the fragment's current args (no id key), updated after refetch */}
			<div id="vars">
				size={handle.variables?.size};param={String(handle.variables?.param)}
			</div>

			<button id="refetch" onClick={() => handle.refetch({ size: 100 })}>
				refetch
			</button>
			<button id="refetch-large" onClick={() => handle.refetch({ size: 200 })}>
				refetch large
			</button>
		</>
	)
}
