<script context="module" lang="ts">
  /** @type {import('@sveltejs/kit').Load} */
  export function load({ error, status }: any) {
    console.log(`error`, error);
    return {
      props: {
        title: `${status}: ${error.message}`
      }
    };
  }
</script>

<script lang="ts">
  export let title: string;
</script>

<h1>{title}</h1>
