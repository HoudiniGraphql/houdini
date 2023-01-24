<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql(`
    query QueryExtNoAutoFetch {
      usersList(limit: 3, snapshot: "QueryExtNoAutoFetch") {
        id
        name
      }
    }
  `);
</script>

<p id="QueryExt-result">
  QueryExtNoAutoFetch - Number of users: {JSON.stringify($store.data?.usersList?.length, null, 2)}
</p>
