<script lang="ts">
  import { fragment, graphql, type UserName } from '$houdini';
  import Loading from './Loading.svelte';

  // TODO:
  // And it can be undefined... because : <UserName user={$GQL_Page_User.data?.user} />
  export let user: UserName | undefined;

  $: frag = fragment(
    user ?? null,
    graphql(`
      fragment UserName on User {
        name
      }
    `)
  );
</script>

{#if $frag}
  {$frag.name}
{:else}
  <Loading />
{/if}
