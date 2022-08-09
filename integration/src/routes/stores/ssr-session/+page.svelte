<script>
  /** @type {import('./$types').Data} */
  export let data;

  $: ({ Session } = data);
</script>

<h1>SSR Session</h1>

<div id="result">
  {$Session.data?.session}
</div>
