<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  import { graphql, type PreprocessorTestQuery1Store } from '$houdini';

  const result: PreprocessorTestQuery1Store = graphql`
    query PreprocessorBeforeLoadTestQuery @load {
      user(id: "1", snapshot: "preprocess-before-load-test-simple") {
        name
      }
    }
  `;
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
