<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const result = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorBeforeLoadTestQuery {
      user(id: "1", snapshot: "preprocess-before-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
