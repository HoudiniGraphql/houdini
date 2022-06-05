<script context="module">
  export function PreprocessorTestQuery2Variables({ stuff }: { stuff: { user?: string } }) {
    return {
      id: stuff.user
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
