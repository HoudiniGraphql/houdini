<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryScalars } from '$houdini';

  const { data } = query<PreprocessorTestQueryScalars>(graphql`
    query PreprocessorTestQueryScalars {
      user(id: "1", snapshot: "preprocess-query-scalars") {
        birthDate
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.birthDate}
</div>
