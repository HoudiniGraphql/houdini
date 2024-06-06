<script lang="ts">
  import { fragment, graphql, type Svelte5UserDetails } from '$houdini';

  interface Props {
    user: Svelte5UserDetails;
  }
  const { user }: Props = $props();

  const userDetails = fragment(
    user,
    graphql(`
      fragment Svelte5UserDetails on User {
        name
        birthDate
      }
    `)
  );
</script>

{$userDetails.name} - Born on: {$userDetails.birthDate?.toDateString()}
