<script lang="ts">
  import { graphql } from '$houdini';

  const q1 = graphql(`
    query q1 @load {
      cities {
        name
      }
    }
  `);

  const q2 = graphql(`
    query q2 {
      city(id: 1) {
        name
      }
    }
  `);

  const q3 = graphql(`
    query q3 {
      city(id: 1) {
        name
      }
    }
  `);
</script>

<div>
  <h3>query 1</h3>
  <pre>{JSON.stringify($q1.data, null, 2)}</pre>
</div>

<div>
  <h3>query 2</h3>
  <pre>{JSON.stringify($q2.data, null, 2)}</pre>
  <button id="load2" on:click={() => q2.fetch()}>Run</button>
</div>

<h3>query 3</h3>
<div id="result">
  <pre>{JSON.stringify($q3.data, null, 2)}</pre>
</div>
<button on:click={() => q3.fetch()}>Run</button>
