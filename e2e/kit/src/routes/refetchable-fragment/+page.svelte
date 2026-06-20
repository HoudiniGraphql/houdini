<script lang="ts">
import { refetchableFragment, graphql } from '$houdini'
import type { PageData } from './$types'

export let data: PageData

$: ({ RefetchableFragmentQuery: queryResult } = data)

$: userInfo = refetchableFragment(
	$queryResult.data?.user ?? null,
	graphql(`
      fragment RefetchableUserInfo on User @refetchable @arguments(size: { type: "Int", default: 50 }) {
        name
        avatarURL(size: $size)
      }
    `)
)
</script>

<div id="result">{$userInfo.data?.avatarURL}</div>

<button id="refetch" on:click={() => userInfo.refetch({ size: 100 })}>refetch</button>
<button id="refetch-large" on:click={() => userInfo.refetch({ size: 200 })}>refetch large</button>
