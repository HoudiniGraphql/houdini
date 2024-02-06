<script lang="ts">
  import { fragment, graphql } from '$houdini';
  $: result = graphql(`
    query UserDetailsWithBirthday {
      user(id: "1", snapshot: "abc") {
        name
        ...UserDetailsArguments @with(showBirthday: true)
      }
    }
  `);
  $: userDetails = fragment(
    $result.data,
    graphql(`
      fragment UserDetailsArguments on User @arguments(showBirthday: { type: "Boolean!" }) {
        id
        birthDate @include(if: $showBirthday)
      }
    `)
  );
</script>
