<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryError } from '$houdini';

  const result = query<PreprocessorTestQueryError>(graphql`
    query PreprocessorTestQueryError($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
