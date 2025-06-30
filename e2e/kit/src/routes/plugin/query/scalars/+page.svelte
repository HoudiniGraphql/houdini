<script>
  import { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PreprocessorTestQueryScalars: result } = data);
</script>

ISO:
<div id="result-date">
  {$result.data?.user.birthDate.toISOString()}
</div>

<br />

Local:
<div id="result-date-local">
  {$result.data?.user.birthDate.toLocaleString()}
</div>
