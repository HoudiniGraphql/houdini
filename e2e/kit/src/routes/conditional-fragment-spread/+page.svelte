<script lang="ts">
import { graphql } from '$houdini'
import type { PageData } from './$types'

export let data: PageData

// the fragment selects a non-null field. since the spread above is excluded by
// @include(if: false), the missing value must not null out the parent
graphql(`
    fragment ConditionalFragmentSpreadDetails on User {
        avatarURL
    }
`)

$: ({ ConditionalFragmentSpreadQuery: store } = data)
</script>

{#if $store.data}
  <div id="result">{$store.data.user.id}:{$store.data.user.name}</div>
{:else}
  <div id="result">no data</div>
{/if}
