<script lang="ts">
  import {
    query,
    graphql,
    type PreprocessorTestQuery3Store,
    type PreprocessorTestQuery4Store
  } from '$houdini';

  const result1: PreprocessorTestQuery3Store = graphql`
    query PreprocessorTestQuery3 {
      user(id: "1", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `;

  const result2: PreprocessorTestQuery4Store = graphql`
    query PreprocessorTestQuery4 {
      user(id: "2", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `;
</script>

<div id="result1">
  {$result1.data?.user.name}
</div>
<div id="result2">
  {$result2.data?.user.name}
</div>
