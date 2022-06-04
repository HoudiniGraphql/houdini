<script lang="ts">
  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const { data } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorTestQuery1 {
      user(id: "1") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
