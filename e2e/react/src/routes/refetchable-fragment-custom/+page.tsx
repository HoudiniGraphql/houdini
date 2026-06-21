import { graphql, useFragmentHandle } from '$houdini'
import type { PageProps } from './$types'

// RefetchableEntity is NOT a Node — it is refetchable via the resolve config in
// houdini.config.ts (queryField: 'refetchableEntity'). This exercises the custom-resolve
// refetch path end to end.
const fragment = graphql(`
	fragment RefetchableEntityInfo on RefetchableEntity @refetchable @arguments(size: { type: "Int", default: 50 }) {
		avatarURL(size: $size)
	}
`)

export default function ({ RefetchableCustomQuery }: PageProps) {
	const handle = useFragmentHandle(RefetchableCustomQuery.refetchableEntity, fragment)

	return (
		<>
			<div id="result">{handle.data?.avatarURL}</div>
			{/* variables expose only the fragment args; the synthetic id (from resolve.arguments) must not leak */}
			<div id="vars">
				size={handle.variables?.size};id={(handle.variables as any)?.id ?? 'none'}
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
