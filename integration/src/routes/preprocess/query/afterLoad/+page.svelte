<script context="module">
  // @ts-ignore
  export function afterLoad({ data }) {
    return {
      props: {
        message: data.PreprocessorAfterLoadTestQuery.user.name[0]
      }
    };
  }
</script>

<script lang="ts">
  export let message = '';

  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const { data } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorAfterLoadTestQuery {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {message}: {$data?.user.name}
</div>
