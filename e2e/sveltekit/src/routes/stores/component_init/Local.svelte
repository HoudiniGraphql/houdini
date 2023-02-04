<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql(`
    query LocalComponent {
      usersList(limit: 3, snapshot: "LocalComponent") {
        id
        name
      }
    }
  `);

  async function onClick() {
    const result = await store.fetch();
    console.log('do something with', result);
  }
</script>

<p id="QueryExt-result">
  LocalComponent - Number of users: {JSON.stringify($store.data?.usersList?.length, null, 2)}
</p>

<button on:click={onClick} type="button">Click me</button>
