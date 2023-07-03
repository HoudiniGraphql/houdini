<script>
  import { graphql } from '$houdini';

  const updates = graphql(`
    subscription UserUpdatesOne {
      userUpdate(id: "1", snapshot: "subscription-test") {
        name
      }
    }
  `);
  const updates2 = graphql(`
    subscription UserUpdatesTwo {
      userUpdate(id: "1", snapshot: "subscription-test") {
        name
      }
    }
  `);
  const update = graphql(`
    mutation SubscriptionTestUpdateUserTwo($name: String!) {
      updateUser(id: "1", snapshot: "subscription-test", name: $name) {
        id
      }
    }
  `);
</script>

<button id="listen" on:click={() => updates.listen()}>listen to 1st sub</button>
<button id="listen" on:click={() => updates2.listen()}>listen to 2nd sub</button>
<button id="unlisten" on:click={() => updates.unlisten()}>unlisten 1st sub</button>
<button id="unlisten" on:click={() => updates2.unlisten()}>unlisten 2nd sub</button>

<button id="mutate-foo" on:click={() => update.mutate({ name: 'foo' })}>foo</button>
<button id="mutate-bar" on:click={() => update.mutate({ name: 'bar' })}>bar</button>

<div id="fetching">
  Fetching 1st sub:
  {$updates.fetching}
</div>
<div id="fetching">
  Fetching 2nd sub:
  {$updates2.fetching}
</div>

<div>
  {JSON.stringify($updates.data)}
</div>

<div>
  {JSON.stringify($updates2.data)}
</div>
