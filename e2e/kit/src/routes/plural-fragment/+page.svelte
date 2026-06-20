<script lang="ts">
import { graphql } from '$houdini'
import type { PageData } from './$types'
import PluralUserList from './PluralUserList.svelte'

export let data: PageData
$: ({ PluralListUsers } = data)
$: firstId = $PluralListUsers.data?.usersList[0]?.id

// updating a single record should re-render just that row of the plural fragment
const updateFirst = graphql(`
    mutation PluralKitUpdate($id: ID!, $name: String!) {
        updateUserByID(id: $id, snapshot: "plural-fragment", name: $name) {
            id
            name
        }
    }
`)

// inserting grows the list the plural fragment is bound to
const addNew = graphql(`
    mutation PluralKitAdd($name: String!, $birthDate: DateTime!) {
        addUser(snapshot: "plural-fragment", name: $name, birthDate: $birthDate) {
            ...PluralUsersKit_insert @prepend
        }
    }
`)
</script>

<div id="result">
  {#if $PluralListUsers.data}
    <PluralUserList users={$PluralListUsers.data.usersList} />
  {/if}
</div>

<button
  data-test-action="update-first"
  on:click={() => firstId && updateFirst.mutate({ id: firstId, name: 'Updated Bruce' })}
>
  Update first
</button>
<button
  data-test-action="add-new"
  on:click={() => addNew.mutate({ name: 'Brand New User', birthDate: new Date('2000-01-01') })}
>
  Add new
</button>
