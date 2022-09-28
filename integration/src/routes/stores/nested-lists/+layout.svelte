<script lang="ts">
  import { graphql } from '$houdini';

  const UsersList = graphql`
    query NestedListLayoutQuery {
      usersList(snapshot: "nested-list") {
        id
      }
    }
  `;
</script>

<div id="parent-list">
  {JSON.stringify($UsersList.data)}
</div>

<slot />
