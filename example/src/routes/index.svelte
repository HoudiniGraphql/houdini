<!-- 
    I couldn't figure out how to only have [filter].svelte. As far as I can tell,
    there HAS to be an index.svelte file. so let's redirect to /active
-->
<script context="module">
    export async function preload(page, session) {
      return this.redirect(301, 'all')
    }
</script>