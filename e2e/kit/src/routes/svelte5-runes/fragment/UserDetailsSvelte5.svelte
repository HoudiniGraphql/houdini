<script lang="ts">
  import { fragment, graphql, type Svelte5UserDetails } from '$houdini';

  const { user }: { user: Svelte5UserDetails } = $props();

  const userDetails = $derived(
    fragment(
      user,
      graphql(`
        fragment Svelte5UserDetails on User {
          name
          birthDate
        }
      `)
    )
  );
</script>

{$userDetails.name} - Born on: {$userDetails.birthDate?.toDateString()}
