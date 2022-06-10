<script lang="ts">
  import {
    query,
    graphql,
    type PreprocessorTestQuery3,
    type PreprocessorTestQuery4
  } from '$houdini';

  const { data: data1 } = query<PreprocessorTestQuery3>(graphql`
    query PreprocessorTestQuery3 {
      user(id: "1", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `);

  const { data: data2 } = query<PreprocessorTestQuery4>(graphql`
    query PreprocessorTestQuery4 {
      user(id: "2", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `);
</script>

<div id="result1">
  {$data1?.user.name}
</div>
<div id="result2">
  {$data2?.user.name}
</div>
