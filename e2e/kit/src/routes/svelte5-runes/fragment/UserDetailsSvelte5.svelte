<script lang="ts">
  import { fragment, graphql, type Svelte5UserDetails } from '$houdini';

  const { user } = $props<{ user: Svelte5UserDetails }>();

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
