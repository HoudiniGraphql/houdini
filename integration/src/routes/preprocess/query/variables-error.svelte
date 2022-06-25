<script context="module" lang="ts">
  export function PreprocessorTestQueryErrorVariables({ params }: { params: { id?: string } }) {
    // @ts-ignore
    return this.error(403, 'test');
  }
</script>

<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryError } from '$houdini';

  const { data } = query<PreprocessorTestQueryError>(graphql`
    query PreprocessorTestQueryError($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
