<script lang="ts">
  import { query, graphql } from '$houdini';
  import type { LayoutTestQuery } from '$houdini';

  const result = query<LayoutTestQuery>(graphql`
    query LayoutTestQuery {
      user(id: "1", snapshot: "preprocess-query-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
