<script lang="ts">
import type { PageData } from './$types'
import PluralUserList from './PluralUserList.svelte'

export let data: PageData
$: ({ PluralListUsers } = data)
</script>

<div id="result">
  {#if $PluralListUsers.data}
    <PluralUserList users={$PluralListUsers.data.usersList} />
  {/if}
</div>
