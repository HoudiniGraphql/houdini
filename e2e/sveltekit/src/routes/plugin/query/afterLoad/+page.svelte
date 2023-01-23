<script lang="ts">
  import { graphql, PreprocessorTestQuery1Store } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  const result: PreprocessorTestQuery1Store = graphql`
    query PreprocessorAfterLoadTestQuery @load {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
  `;
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
