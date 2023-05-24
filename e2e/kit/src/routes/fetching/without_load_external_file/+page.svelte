<script lang="ts">
  import { without_load_external_fileStore } from '$houdini';
  $: store = new without_load_external_fileStore({ fetching: false });
  const getData = () => {
    store.fetch();
  };
  $: console.info(`without_load_external_fileStore - fetching: ${$store.fetching}`);
</script>

<button on:click={getData}>Fetch</button>

<pre>{JSON.stringify($store, null, 2)}</pre>
