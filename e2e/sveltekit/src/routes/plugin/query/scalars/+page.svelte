<script>
  import { graphql } from '$houdini';

  const result = graphql`
    query PreprocessorTestQueryScalars @load {
      user(id: "1", snapshot: "preprocess-query-scalars") {
        id
        birthDate
      }
    }
  `;
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
