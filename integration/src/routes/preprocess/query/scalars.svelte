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

<div id="result-date">
  {$data?.user.birthDate.toISOString()}
</div>
