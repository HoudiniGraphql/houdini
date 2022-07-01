<script context="module">
  export function afterLoad({ data }) {
    return {
      props: {
        message: data.PreprocessorBeforeLoadTestQuery.user.name[0]
      }
    };
  }
</script>

<script lang="ts">
  export let message: string = '';

  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const { data } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorBeforeLoadTestQuery {
      user(id: "1", snapshot: "preprocess-before-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {message}: {$data?.user.name}
</div>
