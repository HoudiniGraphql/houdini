<script lang="ts">
  import { fragment, graphql, type The_others } from '$houdini';

  export let others: The_others;
  $: othersStore = fragment(
    others,
    graphql`
      fragment The_others on OtherConnection {
        edges {
          node {
            ... on Book {
              __typename
              id
            }
            ... on CustomArticleInterface {
              __typename
              id
              isCustom
            }
          }
        }
      }
    `
  );

  $: console.log({ others: $othersStore });
</script>

{JSON.stringify(othersStore, undefined, 2)}
