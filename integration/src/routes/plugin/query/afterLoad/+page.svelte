<script lang="ts">
  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  const result = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorAfterLoadTestQuery {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
