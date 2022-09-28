<script lang="ts">
  import { graphql } from '$houdini';

  const UsersList = graphql`
    query NestedListLayoutQuery {
      usersList(snapshot: "nested-list") {
        id
        nested {
          something
        }
      }
    }
  `;
</script>

<div id="parent-list">
  {JSON.stringify($UsersList.data)}
</div>

<slot />
