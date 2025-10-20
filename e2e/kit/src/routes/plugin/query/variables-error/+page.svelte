<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$types';

  export let data: PageData;

  $:({ PreprocessorTestQueryError: result } = data)

</script>

<div id="result">
  {$result.data?.user.name}
</div>
