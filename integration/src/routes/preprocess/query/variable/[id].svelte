<script context="module">
  export function PreprocessorTestQuery2Variables({ params }: { params: { id?: string } }) {
    return {
      id: params.id || '1'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const { data } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorTestQuery2($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
