<script lang="ts">
  import {
    CachePolicy,
    fragment,
    GQL_UserRequired,
    GQL_UserRequiredFragments,
    graphql
  } from '$houdini';

  async function getUser(id: string, forceNullDate: boolean) {
    await Promise.all([
      GQL_UserRequired.fetch({
        variables: { id, forceNullDate },
        policy: CachePolicy.NetworkOnly
      }),
      GQL_UserRequiredFragments.fetch({
        variables: { id, forceNullDate },
        policy: CachePolicy.NetworkOnly
      })
    ]);
  }

  $: withRequired = fragment(
    $GQL_UserRequiredFragments.data?.user,
    graphql`
      fragment UserWithRequired on User {
        name
        birthDate @required
      }
    `
  );

  $: withoutRequired = fragment(
    $GQL_UserRequiredFragments.data?.user,
    graphql`
      fragment UserWithoutRequired on User {
        name
        birthDate
      }
    `
  );
</script>

<button id="getNonNull" on:click={() => getUser('1', false)}
  >GET User with non-null birthdate</button
>
<button id="getNull" on:click={() => getUser('2', true)}>GET User with null birthdate</button>

<h1>Queries</h1>
<div id="query-result">
  <pre>{JSON.stringify($GQL_UserRequired.data, null, 2)}</pre>
</div>

<h1>Fragments</h1>
<div id="fragment-result">
  <pre>{JSON.stringify(
      { withRequired: $withRequired, withoutRequired: $withoutRequired },
      null,
      2
    )}</pre>
</div>
