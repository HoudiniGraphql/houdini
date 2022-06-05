<script context="module" lang="ts">
  export async function load({
    params: { key, value }
  }: {
    params: { key: string; value: string };
  }) {
    return {
      stuff: {
        [key]: value
      }
    };
  }
</script>
