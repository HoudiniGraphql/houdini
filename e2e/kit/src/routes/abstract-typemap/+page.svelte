<script lang="ts">
import type { PageData } from './$types'

export let data: PageData
$: ({ MixedTypeMapQuery } = data)
$: result = $MixedTypeMapQuery.data?.userResult
</script>

<div id="result">
  {result && 'name' in result ? `${result.id}:${result.name}` : 'null'}
</div>
