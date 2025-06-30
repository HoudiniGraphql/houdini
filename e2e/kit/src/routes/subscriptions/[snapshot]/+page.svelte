<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ SubscriptionTestUserList: List } = data)

  const updates = graphql(`
    subscription UserUpdates {
      userUpdate(id: "1", snapshot: "subscription-test") {
        name
      }
    }
  `);

  const update = graphql(`
    mutation SubscriptionTestUpdateUser($name: String!) {
      updateUser(id: "1", snapshot: "subscription-test", name: $name) {
        id
      }
    }
  `);
</script>

<button id="listen" on:click={() => updates.listen()}>listen</button>
<button id="unlisten" on:click={() => updates.unlisten()}>unlisten</button>

<button id="mutate-foo" on:click={() => update.mutate({ name: 'foo' })}>foo</button>
<button id="mutate-bar" on:click={() => update.mutate({ name: 'bar' })}>bar</button>

<div id="fetching">
  {$updates.fetching}
</div>

<div id="result">
  {$List.data?.user.name}
</div>
