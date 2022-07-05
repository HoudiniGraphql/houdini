<script context="module" lang="ts">
  import type { LoadEvent } from '@sveltejs/kit';

  export function load(event: LoadEvent) {
    console.log(`error`, event.error);
    return {
      props: {
        title: `${event.status}: ${event.error?.message}`
      }
    };
  }
</script>

<script lang="ts">
  export let title: string;
</script>

<h1>{title}</h1>
