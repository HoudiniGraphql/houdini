<script lang="ts">
  import { fragment, graphql, type The_articles } from '$houdini';

  export let articles: The_articles;
  $: articlesStore = fragment(
    articles,
    graphql`
      fragment The_articles on ArticleConnection {
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

  $: console.log(JSON.stringify(articlesStore, null, 2));
</script>

{JSON.stringify(articlesStore, undefined, 2)}
