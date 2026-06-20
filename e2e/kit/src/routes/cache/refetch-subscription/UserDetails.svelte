<script lang="ts">
import { fragment, graphql, type RefetchSubUserDetails } from '$houdini'

export let user: RefetchSubUserDetails | null

$: data = fragment(
	user,
	graphql(`
		fragment RefetchSubUserDetails on User {
			name
		}
	`)
)
</script>

<div id="user-name">{$data?.name}</div>
