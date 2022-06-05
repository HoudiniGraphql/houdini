<script lang="ts">
  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const { data: data1 } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorTestQuery3 {
      user(id: "1") {
        name
      }
    }
  `);

  const { data: data2 } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorTestQuery4 {
      user(id: "2") {
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
