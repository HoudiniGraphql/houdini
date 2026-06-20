<script lang="ts">
import { refetchableFragment, graphql } from '$houdini'
import type { PageData } from './$types'

export let data: PageData

$: ({ RefetchableCustomQuery: queryResult } = data)

// RefetchableEntity is NOT a Node — it is refetchable via the resolve config in
// houdini.config.js (queryField: 'refetchableEntity'). This exercises the custom-resolve
// refetch path end to end.
$: entity = refetchableFragment(
	$queryResult.data?.refetchableEntity ?? null,
	graphql(`
      fragment RefetchableEntityInfo on RefetchableEntity @refetchable @arguments(size: { type: "Int", default: 50 }) {
        avatarURL(size: $size)
      }
    `)
)
</script>

<div id="result">{$entity.data?.avatarURL}</div>

<button id="refetch" on:click={() => entity.refetch({ size: 100 })}>refetch</button>
<button id="refetch-large" on:click={() => entity.refetch({ size: 200 })}>refetch large</button>
