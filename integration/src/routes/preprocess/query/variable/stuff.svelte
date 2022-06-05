<script context="module">
  export function PreprocessorTestQuery2Variables({ stuff }: { stuff: { user?: string } }) {
    return {
      id: stuff.user
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type PreprocessorStuffQuery } from '$houdini';

  const { data } = query<PreprocessorStuffQuery>(graphql`
    query PreprocessorStuffQuery($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
