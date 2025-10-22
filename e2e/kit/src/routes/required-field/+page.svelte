<script lang="ts">
  import {
    CachePolicy,
    fragment,
    UserRequiredStore,
    UserRequiredFragmentsStore,
    graphql
  } from '$houdini';
  import { stringify } from '$lib/utils/stringify';

  const userRequired = new UserRequiredStore();
  const userRequiredFragments = new UserRequiredFragmentsStore();

  async function getUser(id: string, forceNullDate: boolean) {
    await Promise.all([
      userRequired.fetch({
        variables: { id, forceNullDate },
        policy: CachePolicy.NetworkOnly
      }),
      userRequiredFragments.fetch({
        variables: { id, forceNullDate },
        policy: CachePolicy.NetworkOnly
      })
    ]);
  }

  $: withRequired = fragment(
    $userRequiredFragments.data?.user,
    graphql(`
      fragment UserWithRequired on User {
        name
        birthDate @required
      }
    `)
  );

  $: withoutRequired = fragment(
    $userRequiredFragments.data?.user,
    graphql(`
      fragment UserWithoutRequired on User {
        name
        birthDate
      }
    `)
  );
</script>

<button id="getNonNull" on:click={() => getUser('1', false)}
  >GET User with non-null birthdate</button
>
<button id="getNull" on:click={() => getUser('2', true)}>GET User with null birthdate</button>

<h1>Queries</h1>
<div id="query-result">
  <pre>{stringify($userRequired.data, null, 2)}</pre>
</div>

<h1>Fragments</h1>
<div id="fragment-result">
  <pre>{stringify(
      { withRequired: $withRequired, withoutRequired: $withoutRequired },
      null,
      2
    )}</pre>
</div>
