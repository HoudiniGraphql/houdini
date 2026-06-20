<script lang="ts">
import { fragment, graphql, type PluralUserRow } from '$houdini'

// the @plural fragment reference type is already an array
export let users: PluralUserRow

$: data = fragment(
	users,
	graphql(`
      fragment PluralUserRow on User @plural {
        id
        name
      }
    `)
)
</script>

<ul>
  {#each $data as user}
    <li>{user.name}</li>
  {/each}
</ul>
