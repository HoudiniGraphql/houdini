import { session } from '$app/stores'
import { derived, writable } from 'svelte/store'

const local = writable(null)

export default derived(
	[local, session],
	([$local, $session]) => $local || $session?.mode || 'inline'
)

export function setMode(mode) {
	fetch('/setMode', {
		method: 'POST',
		body: JSON.stringify({
			mode: mode
		})
	})

	local.set(mode)
}
