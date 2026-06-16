<script lang="ts">
import { fragment, graphql, type RefreshCacheUserDetails } from '$houdini'

export let user: RefreshCacheUserDetails | null

$: data = fragment(
	user,
	graphql(`
		fragment RefreshCacheUserDetails on User {
			name
		}
	`)
)
</script>

<div id="user-name">{$data?.name}</div>
