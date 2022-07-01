<script context="module">
  export function beforeLoad() {
    return {
      props: {
        message: 'hello'
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
