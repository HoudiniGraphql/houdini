<script lang="ts">
  import { query, graphql, type LayoutTestQuery } from '$houdini/index.js';

  const { data } = query<LayoutTestQuery>(graphql`
    query LayoutTestQuery {
      user(id: "1", snapshot: "preprocess-query-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
