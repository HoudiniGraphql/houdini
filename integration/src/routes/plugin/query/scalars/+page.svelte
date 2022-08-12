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

ISO:
<div id="result-date">
  {$data?.user.birthDate.toISOString()}
</div>

<br />

Local:
<div id="result-date-local">
  {$data?.user.birthDate.toLocaleString()}
</div>
