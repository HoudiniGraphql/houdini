<script>
  import { query, graphql } from '$houdini';

  const result = query(graphql`
    query PreprocessorTestQueryScalars {
      user(id: "1", snapshot: "preprocess-query-scalars") {
        id
        birthDate
      }
    }
  `);
</script>

ISO:
<div id="result-date">
  {$result.data?.user.birthDate.toISOString()}
</div>

<br />

Local:
<div id="result-date-local">
  {$result.data?.user.birthDate.toLocaleString()}
</div>
