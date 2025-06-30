<script lang="ts">
  import { graphql, type SessionStore } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: PageData;
  $: ({ Session } = data)
</script>

<h1>SSR Session</h1>

<div id="result">
  {$Session.data?.session}
</div>
