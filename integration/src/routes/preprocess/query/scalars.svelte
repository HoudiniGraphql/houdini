<script>
  import { query, graphql } from '$houdini';

  const { data } = query(graphql`
    query PreprocessorTestQueryScalars {
      user(id: "1", snapshot: "preprocess-query-scalars") {
        id
        birthDate
      }
    }
  `);
</script>

<div id="result-id">
  {#if typeof $data?.user.id.toISOString === 'function'}
    {$data?.user.id.toISOString()}
  {:else}
    Not a date!
  {/if}
</div>

<div id="result-date">
  {$data?.user.birthDate.toISOString()}
</div>
