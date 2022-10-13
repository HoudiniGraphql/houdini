<script lang="ts">
  import { fragment, graphql, type UserName } from '$houdini';
  import Loading from './Loading.svelte';

  // TODO:
  // And it can be undefined... because : <UserName user={$GQL_Page_User.data?.user} />
  export let user: UserName | undefined;

  $: data =
    user &&
    fragment(
      user,
      graphql`
        fragment UserName on User {
          name
        }
      `
    );
</script>

{#if $data}
  {$data.name}
{:else}
  <Loading />
{/if}
