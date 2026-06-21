<script lang="ts">
import { refetchableFragment, graphql } from '$houdini'
import type { PageData } from './$types'

export let data: PageData

$: ({ RefetchableFragmentQuery: queryResult } = data)

$: userInfo = refetchableFragment(
	$queryResult.data?.user ?? null,
	graphql(`
      fragment RefetchableUserInfo on User @refetchable @arguments(size: { type: "Int", default: 50 }, param: { type: "Boolean", default: false }) {
        name
        avatarURL(size: $size)
        testField(someParam: $param)
      }
    `)
)
</script>

<div id="result">{$userInfo.data?.avatarURL}</div>
<!-- testField reflects the `param` argument; we refetch only `size`, so this must survive -->
<div id="merge">{$userInfo.data?.testField}</div>
<!-- variables reflect the fragment's current args (no id key), updated after refetch -->
<div id="vars">size={$userInfo.variables?.size};param={$userInfo.variables?.param}</div>

<button id="refetch" on:click={() => userInfo.refetch({ size: 100 })}>refetch</button>
<button id="refetch-large" on:click={() => userInfo.refetch({ size: 200 })}>refetch large</button>
