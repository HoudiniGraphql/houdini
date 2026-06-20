<script lang="ts">
import { fragment, graphql, type RefetchCacheUserDetails } from '$houdini'

export let user: RefetchCacheUserDetails | null

$: data = fragment(
	user,
	graphql(`
		fragment RefetchCacheUserDetails on User {
			name
		}
	`)
)
</script>

<div id="user-name">{$data?.name}</div>
